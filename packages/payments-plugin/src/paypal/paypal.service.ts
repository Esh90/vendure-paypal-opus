import { Inject, Injectable } from '@nestjs/common';
import {
    ApiError,
    CheckoutPaymentIntent,
    Order as PayPalOrder,
    OrderApplicationContextShippingPreference,
    OrderApplicationContextUserAction,
    OrderAuthorizeResponse,
} from '@paypal/paypal-server-sdk';
import {
    InternalServerError,
    Logger,
    Order,
    PaymentMethod,
    PaymentMethodService,
    RequestContext,
    UserInputError,
} from '@vendure/core';

import {
    DEFAULT_CANCEL_URL,
    DEFAULT_RETURN_URL,
    loggerCtx,
    PAYPAL_PLUGIN_OPTIONS,
} from './constants';
import { PayPalClient } from './paypal-client';
import { paypalPaymentMethodHandler } from './paypal.handler';
import { fromPayPalAmount, toPayPalAmount } from './paypal-utils';
import { PayPalPaymentIntent, PayPalPluginOptions } from './types';

/**
 * The result of creating a PayPal order, returned to the storefront so it can
 * drive the buyer-approval step (either via redirect or the embedded Smart
 * Payment Buttons).
 */
export interface CreatePayPalOrderResult {
    id: string;
    status: string;
    approveUrl?: string;
}

/**
 * The result of capturing a PayPal order, used by the payment handler to record
 * the payment against the Vendure order.
 */
export interface CapturePayPalOrderResult {
    orderStatus: string;
    captureId: string;
    captureStatus: string;
    amount: number;
    currencyCode: string;
}

/**
 * The result of authorizing a PayPal order, used by the payment handler to record
 * an authorized (not yet captured) payment against the Vendure order.
 */
export interface AuthorizePayPalOrderResult {
    orderStatus: string;
    authorizationId: string;
    authorizationStatus: string;
}

/**
 * The result of capturing a previously-authorized PayPal payment.
 */
export interface CaptureAuthorizationResult {
    captureId: string;
    captureStatus: string;
}

@Injectable()
export class PayPalService {
    private client: PayPalClient | undefined;
    private warnedAboutDefaultUrls = false;

    constructor(
        @Inject(PAYPAL_PLUGIN_OPTIONS) private options: PayPalPluginOptions,
        private paymentMethodService: PaymentMethodService,
    ) {}

    /**
     * Creates a PayPal order for the given Vendure order. The order's intent
     * (`CAPTURE` or `AUTHORIZE`) is taken from the configured PayPal payment
     * method. The returned order is in the `CREATED` state and must be approved
     * by the buyer before it can be captured or authorized.
     */
    async createOrder(ctx: RequestContext, order: Order): Promise<CreatePayPalOrderResult> {
        const method = await this.getPaymentMethod(ctx);
        await this.assertPaymentMethodEligible(ctx, order, method);
        const intent = this.getConfiguredIntent(method);

        const currencyCode = order.currencyCode;
        const value = toPayPalAmount(order.totalWithTax, currencyCode);
        const { returnUrl, cancelUrl } = this.resolveRedirectUrls();

        try {
            const { result } = await this.getClient().orders.createOrder({
                body: {
                    intent,
                    purchaseUnits: [
                        {
                            referenceId: 'default',
                            customId: order.code,
                            description: `Order ${order.code}`,
                            amount: {
                                currencyCode,
                                value,
                            },
                        },
                    ],
                    applicationContext: {
                        brandName: this.options.brandName,
                        userAction: OrderApplicationContextUserAction.PayNow,
                        shippingPreference: OrderApplicationContextShippingPreference.NoShipping,
                        // PayPal requires a redirect target for the hosted approval flow;
                        // without it the buyer-approval page never completes.
                        returnUrl,
                        cancelUrl,
                    },
                },
                prefer: 'return=representation',
                // Idempotency key: the same cart total + intent yields the same PayPal
                // order, preventing duplicate orders if the storefront retries the call.
                paypalRequestId: `create-${order.code}-${intent}-${currencyCode}-${value}`,
            });

            if (!result.id) {
                throw new InternalServerError('PayPal did not return an order id');
            }

            const approveUrl = result.links?.find(
                link => link.rel === 'approve' || link.rel === 'payer-action',
            )?.href;

            Logger.verbose(
                `Created PayPal order ${result.id} (${result.status ?? 'unknown'}) for order ${order.code}`,
                loggerCtx,
            );

            return {
                id: result.id,
                status: result.status ?? 'CREATED',
                approveUrl,
            };
        } catch (e) {
            throw this.handleApiError(e, `Failed to create PayPal order for order ${order.code}`);
        }
    }

    /**
     * Retrieves the intent (`CAPTURE` or `AUTHORIZE`) that a PayPal order was
     * created with. This is the authoritative source of truth for how an
     * approved order must be processed, ensuring the capture/authorize action
     * always matches the order and avoiding `ACTION_DOES_NOT_MATCH_INTENT`
     * (HTTP 422) errors.
     */
    async getOrderIntent(ctx: RequestContext, paypalOrderId: string): Promise<CheckoutPaymentIntent> {
        try {
            const { result } = await this.getClient().orders.getOrder({ id: paypalOrderId });
            return result.intent === CheckoutPaymentIntent.Authorize
                ? CheckoutPaymentIntent.Authorize
                : CheckoutPaymentIntent.Capture;
        } catch (e) {
            throw this.handleApiError(e, `Failed to retrieve PayPal order ${paypalOrderId}`);
        }
    }

    /**
     * Captures a previously-approved PayPal order, moving the funds from the
     * buyer to the merchant.
     */
    async captureOrder(ctx: RequestContext, paypalOrderId: string): Promise<CapturePayPalOrderResult> {
        try {
            const { result } = await this.getClient().orders.captureOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });

            return this.extractCaptureResult(result, paypalOrderId);
        } catch (e) {
            throw this.handleApiError(e, `Failed to capture PayPal order ${paypalOrderId}`);
        }
    }

    private extractCaptureResult(result: PayPalOrder, paypalOrderId: string): CapturePayPalOrderResult {
        const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
        if (!capture?.id || !capture.status) {
            throw new InternalServerError(
                `PayPal capture for order ${paypalOrderId} did not return a capture result`,
            );
        }
        const captureAmount = capture.amount;
        if (!captureAmount?.value || !captureAmount.currencyCode) {
            throw new InternalServerError(
                `PayPal capture ${capture.id} did not return an amount`,
            );
        }
        return {
            orderStatus: result.status ?? 'unknown',
            captureId: capture.id,
            captureStatus: capture.status,
            amount: fromPayPalAmount(captureAmount.value, captureAmount.currencyCode),
            currencyCode: captureAmount.currencyCode,
        };
    }

    /**
     * Authorizes a previously-approved PayPal order, reserving the funds without
     * capturing them. The returned authorization can later be captured (on
     * fulfilment) via {@link captureAuthorization} or voided via
     * {@link voidAuthorization}.
     */
    async authorizeOrder(ctx: RequestContext, paypalOrderId: string): Promise<AuthorizePayPalOrderResult> {
        try {
            const { result } = await this.getClient().orders.authorizeOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });

            return this.extractAuthorizeResult(result, paypalOrderId);
        } catch (e) {
            throw this.handleApiError(e, `Failed to authorize PayPal order ${paypalOrderId}`);
        }
    }

    private extractAuthorizeResult(
        result: OrderAuthorizeResponse,
        paypalOrderId: string,
    ): AuthorizePayPalOrderResult {
        const authorization = result.purchaseUnits?.[0]?.payments?.authorizations?.[0];
        if (!authorization?.id || !authorization.status) {
            throw new InternalServerError(
                `PayPal authorization for order ${paypalOrderId} did not return an authorization result`,
            );
        }
        return {
            orderStatus: result.status ?? 'unknown',
            authorizationId: authorization.id,
            authorizationStatus: authorization.status,
        };
    }

    /**
     * Captures the full amount of a previously-authorized PayPal payment. This is
     * a final capture, meaning no further captures can be made against the
     * authorization.
     */
    async captureAuthorization(
        ctx: RequestContext,
        authorizationId: string,
    ): Promise<CaptureAuthorizationResult> {
        try {
            const { result } = await this.getClient().payments.captureAuthorizedPayment({
                authorizationId,
                prefer: 'return=representation',
                // Omitting `amount` captures the full authorized amount.
                body: {
                    finalCapture: true,
                },
            });

            if (!result.id || !result.status) {
                throw new InternalServerError(
                    `PayPal capture of authorization ${authorizationId} did not return a capture result`,
                );
            }
            return {
                captureId: result.id,
                captureStatus: result.status,
            };
        } catch (e) {
            throw this.handleApiError(
                e,
                `Failed to capture PayPal authorization ${authorizationId}`,
            );
        }
    }

    /**
     * Returns the enabled `PaymentMethod` whose handler is the PayPal handler, or
     * throws if none exists.
     */
    async getPaymentMethod(ctx: RequestContext): Promise<PaymentMethod> {
        const method = (
            await this.paymentMethodService.findAll(ctx, { filter: { enabled: { eq: true } } })
        ).items.find(pm => pm.handler.code === paypalPaymentMethodHandler.code);
        if (!method) {
            throw new UserInputError('No enabled PayPal payment method found');
        }
        return method;
    }

    /**
     * Ensures that the given PayPal payment method is eligible for the order
     * before a PayPal order is created.
     */
    private async assertPaymentMethodEligible(
        ctx: RequestContext,
        order: Order,
        paypalMethod: PaymentMethod,
    ): Promise<void> {
        const eligibleMethods = await this.paymentMethodService.getEligiblePaymentMethods(ctx, order);
        const isEligible = eligibleMethods.some(pm => pm.code === paypalMethod.code);
        if (!isEligible) {
            throw new UserInputError(
                `PayPal payment method is not eligible for order ${order.code}`,
            );
        }
    }

    /**
     * Reads the configured checkout intent (`capture` or `authorize`) from the
     * PayPal payment method's handler arguments, defaulting to `capture`.
     */
    private getConfiguredIntent(method: PaymentMethod): CheckoutPaymentIntent {
        const value = method.handler.args.find(arg => arg.name === 'intent')?.value;
        const intent: PayPalPaymentIntent = value === 'authorize' ? 'authorize' : 'capture';
        return intent === 'authorize' ? CheckoutPaymentIntent.Authorize : CheckoutPaymentIntent.Capture;
    }

    /**
     * Resolves the buyer-approval redirect URLs, falling back to localhost
     * defaults (intended for sandbox/local development) when they are not
     * configured. A warning is logged once if the defaults are used, since real
     * storefront URLs should be configured for production.
     */
    private resolveRedirectUrls(): { returnUrl: string; cancelUrl: string } {
        const returnUrl = this.options.returnUrl ?? DEFAULT_RETURN_URL;
        const cancelUrl = this.options.cancelUrl ?? DEFAULT_CANCEL_URL;
        if ((!this.options.returnUrl || !this.options.cancelUrl) && !this.warnedAboutDefaultUrls) {
            this.warnedAboutDefaultUrls = true;
            Logger.warn(
                'PayPalPlugin returnUrl/cancelUrl not configured; falling back to localhost defaults. ' +
                    'Configure them via PayPalPlugin.init() for production.',
                loggerCtx,
            );
        }
        return { returnUrl, cancelUrl };
    }

    private getClient(): PayPalClient {
        if (!this.client) {
            this.client = new PayPalClient(this.options);
        }
        return this.client;
    }

    /**
     * Normalises errors thrown by the PayPal SDK into a logged Vendure error. The
     * original PayPal error body is logged for troubleshooting, while a concise
     * message is surfaced to the caller.
     */
    private handleApiError(e: unknown, context: string): Error {
        if (e instanceof ApiError) {
            const detail =
                typeof e.body === 'string' ? e.body : JSON.stringify(e.result ?? e.message);
            Logger.error(`${context}: [${e.statusCode}] ${detail}`, loggerCtx);
            return new InternalServerError(`${context} (PayPal error ${e.statusCode})`);
        }
        if (e instanceof UserInputError || e instanceof InternalServerError) {
            return e;
        }
        const message = e instanceof Error ? e.message : String(e);
        Logger.error(`${context}: ${message}`, loggerCtx);
        return new InternalServerError(context);
    }
}
