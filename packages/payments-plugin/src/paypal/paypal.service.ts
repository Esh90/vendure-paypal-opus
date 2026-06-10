import { Inject, Injectable } from '@nestjs/common';
import {
    ApiError,
    CheckoutPaymentIntent,
    Order as PayPalOrder,
    OrderApplicationContextShippingPreference,
    OrderApplicationContextUserAction,
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
import { PayPalPluginOptions } from './types';

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

@Injectable()
export class PayPalService {
    private client: PayPalClient | undefined;
    private warnedAboutDefaultUrls = false;

    constructor(
        @Inject(PAYPAL_PLUGIN_OPTIONS) private options: PayPalPluginOptions,
        private paymentMethodService: PaymentMethodService,
    ) {}

    /**
     * Creates a PayPal order with `CAPTURE` intent for the given Vendure order.
     * The returned order is in the `CREATED` state and must be approved by the
     * buyer before it can be captured.
     */
    async createOrder(ctx: RequestContext, order: Order): Promise<CreatePayPalOrderResult> {
        await this.assertPaymentMethodEligible(ctx, order);

        const currencyCode = order.currencyCode;
        const value = toPayPalAmount(order.totalWithTax, currencyCode);
        const { returnUrl, cancelUrl } = this.resolveRedirectUrls();

        try {
            const { result } = await this.getClient().orders.createOrder({
                body: {
                    intent: CheckoutPaymentIntent.Capture,
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
                // Idempotency key: the same cart total yields the same PayPal order,
                // preventing duplicate orders if the storefront retries the call.
                paypalRequestId: `create-${order.code}-${currencyCode}-${value}`,
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
     * Ensures that an enabled PayPal payment method exists and is eligible for the
     * given order before a PayPal order is created.
     */
    private async assertPaymentMethodEligible(ctx: RequestContext, order: Order): Promise<void> {
        const [paypalMethod, eligibleMethods] = await Promise.all([
            this.getPaymentMethod(ctx),
            this.paymentMethodService.getEligiblePaymentMethods(ctx, order),
        ]);
        const isEligible = eligibleMethods.some(pm => pm.code === paypalMethod.code);
        if (!isEligible) {
            throw new UserInputError(
                `PayPal payment method is not eligible for order ${order.code}`,
            );
        }
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
