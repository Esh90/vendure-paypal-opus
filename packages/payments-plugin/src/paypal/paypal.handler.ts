import { AuthorizationStatus, CaptureStatus, CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';
import {
    CancelPaymentErrorResult,
    CancelPaymentResult,
    CreatePaymentErrorResult,
    CreatePaymentResult,
    Injector,
    LanguageCode,
    Logger,
    PaymentMethodHandler,
    RequestContext,
    SettlePaymentErrorResult,
    SettlePaymentResult,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { PayPalService } from './paypal.service';

let paypalService: PayPalService;

/**
 * Reads the `paypalOrderId` (set by the storefront in the `addPaymentToOrder`
 * metadata) and validates it is a non-empty string.
 */
function getPayPalOrderId(metadata: Record<string, any>): string | undefined {
    const value = metadata.paypalOrderId;
    return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The handler for PayPal payments. A single handler supports both checkout flows,
 * selected via the `intent` argument on the payment method:
 *
 * - `capture` (default): funds are captured immediately in `createPayment`, and
 *   the payment settles in a single step (standard checkout).
 * - `authorize`: funds are reserved (authorized) in `createPayment`, leaving the
 *   payment in the `Authorized` state. They are later captured in
 *   `settlePayment`, typically when the order is fulfilled.
 *
 * In both flows the buyer first approves a PayPal order created via the
 * `createPayPalOrder` mutation; the storefront then calls `addPaymentToOrder`
 * passing the approved PayPal order id in `metadata.paypalOrderId`.
 */
export const paypalPaymentMethodHandler = new PaymentMethodHandler({
    code: 'paypal',

    description: [{ languageCode: LanguageCode.en, value: 'PayPal payments' }],

    args: {
        intent: {
            type: 'string',
            defaultValue: 'capture',
            label: [{ languageCode: LanguageCode.en, value: 'Payment intent' }],
            description: [
                {
                    languageCode: LanguageCode.en,
                    value:
                        'Whether funds are captured immediately ("capture") or only reserved and ' +
                        'captured later on fulfilment ("authorize").',
                },
            ],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'capture', label: [{ languageCode: LanguageCode.en, value: 'Capture (immediate)' }] },
                    {
                        value: 'authorize',
                        label: [{ languageCode: LanguageCode.en, value: 'Authorize (capture on fulfilment)' }],
                    },
                ],
            },
        },
    },

    init(injector: Injector) {
        paypalService = injector.get(PayPalService);
    },

    async createPayment(
        ctx,
        order,
        amount,
        _args,
        metadata,
    ): Promise<CreatePaymentResult | CreatePaymentErrorResult> {
        const paypalOrderId = getPayPalOrderId(metadata);
        if (!paypalOrderId) {
            return {
                amount,
                state: 'Error',
                errorMessage: 'Missing required metadata field "paypalOrderId"',
            };
        }

        // The action (capture vs authorize) is driven by the PayPal order's actual
        // intent rather than the payment method config, guaranteeing the action
        // always matches how the order was created (avoids HTTP 422
        // ACTION_DOES_NOT_MATCH_INTENT).
        const intent = await paypalService.getOrderIntent(ctx, paypalOrderId);
        if (intent === CheckoutPaymentIntent.Authorize) {
            return createAuthorizedPayment(ctx, order.code, amount, paypalOrderId);
        }
        return createCapturedPayment(ctx, order.code, amount, paypalOrderId);
    },

    async settlePayment(
        ctx,
        order,
        payment,
        _args,
    ): Promise<SettlePaymentResult | SettlePaymentErrorResult> {
        const authorizationId = payment.metadata?.authorizationId;
        if (typeof authorizationId !== 'string' || authorizationId.length === 0) {
            // A payment reaching settlePayment is an authorized (two-step) payment
            // and must carry an authorizationId. Capture-flow payments are created
            // already in the Settled state and never reach this point. Fail safe
            // rather than marking the payment Settled without capturing funds.
            return {
                success: false,
                errorMessage:
                    'Cannot settle PayPal payment: missing authorizationId in payment metadata',
            };
        }

        const capture = await paypalService.captureAuthorization(ctx, authorizationId);
        if (capture.captureStatus === CaptureStatus.Completed) {
            return {
                success: true,
                metadata: {
                    captureId: capture.captureId,
                    captureStatus: capture.captureStatus,
                },
            };
        }

        Logger.warn(
            `PayPal capture ${capture.captureId} for order ${order.code} returned status "${capture.captureStatus}"`,
            loggerCtx,
        );
        return {
            success: false,
            errorMessage: `PayPal capture was not completed (status: ${capture.captureStatus})`,
            metadata: {
                captureId: capture.captureId,
                captureStatus: capture.captureStatus,
            },
        };
    },

    async cancelPayment(
        ctx,
        order,
        payment,
    ): Promise<CancelPaymentResult | CancelPaymentErrorResult> {
        const authorizationId = payment.metadata?.authorizationId;
        if (typeof authorizationId !== 'string' || authorizationId.length === 0) {
            // Only authorized (not-yet-captured) PayPal payments can be voided.
            // A captured/settled payment must be refunded instead.
            return {
                success: false,
                errorMessage:
                    'Cannot void PayPal payment: missing authorizationId in payment metadata ' +
                    '(only authorized, uncaptured payments can be cancelled)',
            };
        }

        try {
            const result = await paypalService.voidAuthorization(ctx, authorizationId);
            Logger.verbose(
                `Voided PayPal authorization ${authorizationId} for order ${order.code}`,
                loggerCtx,
            );
            return {
                success: true,
                metadata: {
                    voided: true,
                    authorizationId,
                    authorizationStatus: result.authorizationStatus ?? AuthorizationStatus.Voided,
                },
            };
        } catch (e) {
            // PayPal rejects voiding an already-captured authorization (HTTP 422);
            // surface a clean error and leave the payment in its current state.
            const errorMessage = e instanceof Error ? e.message : String(e);
            return {
                success: false,
                errorMessage,
            };
        }
    },
});

/**
 * Immediate-capture flow (standard checkout): captures the approved PayPal order
 * and settles the payment in one step.
 */
async function createCapturedPayment(
    ctx: RequestContext,
    orderCode: string,
    amount: number,
    paypalOrderId: string,
): Promise<CreatePaymentResult | CreatePaymentErrorResult> {
    const capture = await paypalService.captureOrder(ctx, paypalOrderId);
    const paymentMetadata = {
        paypalOrderId,
        captureId: capture.captureId,
        captureStatus: capture.captureStatus,
        orderStatus: capture.orderStatus,
    };

    if (capture.captureStatus === CaptureStatus.Completed) {
        return {
            amount: capture.amount,
            state: 'Settled',
            transactionId: capture.captureId,
            metadata: paymentMetadata,
        };
    }

    Logger.warn(
        `PayPal capture ${capture.captureId} for order ${orderCode} returned status "${capture.captureStatus}"`,
        loggerCtx,
    );
    return {
        amount: capture.amount,
        state: 'Declined',
        transactionId: capture.captureId,
        errorMessage: `PayPal capture was not completed (status: ${capture.captureStatus})`,
        metadata: paymentMetadata,
    };
}

/**
 * Authorize-then-capture flow: authorizes (reserves) the funds for the approved
 * PayPal order, leaving the payment in the `Authorized` state for later capture.
 */
async function createAuthorizedPayment(
    ctx: RequestContext,
    orderCode: string,
    amount: number,
    paypalOrderId: string,
): Promise<CreatePaymentResult | CreatePaymentErrorResult> {
    const authorization = await paypalService.authorizeOrder(ctx, paypalOrderId);
    const paymentMetadata = {
        paypalOrderId,
        authorizationId: authorization.authorizationId,
        authorizationStatus: authorization.authorizationStatus,
        orderStatus: authorization.orderStatus,
    };

    if (authorization.authorizationStatus === AuthorizationStatus.Created) {
        return {
            amount,
            state: 'Authorized',
            transactionId: authorization.authorizationId,
            metadata: paymentMetadata,
        };
    }

    Logger.warn(
        `PayPal authorization ${authorization.authorizationId} for order ${orderCode} returned status "${authorization.authorizationStatus}"`,
        loggerCtx,
    );
    return {
        amount,
        state: 'Declined',
        transactionId: authorization.authorizationId,
        errorMessage: `PayPal authorization was not successful (status: ${authorization.authorizationStatus})`,
        metadata: paymentMetadata,
    };
}
