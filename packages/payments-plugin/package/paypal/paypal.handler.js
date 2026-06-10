"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paypalPaymentMethodHandler = void 0;
const paypal_server_sdk_1 = require("@paypal/paypal-server-sdk");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const paypal_service_1 = require("./paypal.service");
let paypalService;
/**
 * Reads the `paypalOrderId` (set by the storefront in the `addPaymentToOrder`
 * metadata) and validates it is a non-empty string.
 */
function getPayPalOrderId(metadata) {
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
exports.paypalPaymentMethodHandler = new core_1.PaymentMethodHandler({
    code: 'paypal',
    description: [{ languageCode: core_1.LanguageCode.en, value: 'PayPal payments' }],
    args: {
        intent: {
            type: 'string',
            defaultValue: 'capture',
            label: [{ languageCode: core_1.LanguageCode.en, value: 'Payment intent' }],
            description: [
                {
                    languageCode: core_1.LanguageCode.en,
                    value: 'Whether funds are captured immediately ("capture") or only reserved and ' +
                        'captured later on fulfilment ("authorize").',
                },
            ],
            ui: {
                component: 'select-form-input',
                options: [
                    { value: 'capture', label: [{ languageCode: core_1.LanguageCode.en, value: 'Capture (immediate)' }] },
                    {
                        value: 'authorize',
                        label: [{ languageCode: core_1.LanguageCode.en, value: 'Authorize (capture on fulfilment)' }],
                    },
                ],
            },
        },
    },
    init(injector) {
        paypalService = injector.get(paypal_service_1.PayPalService);
    },
    async createPayment(ctx, order, amount, _args, metadata) {
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
        if (intent === paypal_server_sdk_1.CheckoutPaymentIntent.Authorize) {
            return createAuthorizedPayment(ctx, order.code, amount, paypalOrderId);
        }
        return createCapturedPayment(ctx, order.code, amount, paypalOrderId);
    },
    async settlePayment(ctx, order, payment, _args) {
        var _a;
        const authorizationId = (_a = payment.metadata) === null || _a === void 0 ? void 0 : _a.authorizationId;
        if (typeof authorizationId !== 'string' || authorizationId.length === 0) {
            // A payment reaching settlePayment is an authorized (two-step) payment
            // and must carry an authorizationId. Capture-flow payments are created
            // already in the Settled state and never reach this point. Fail safe
            // rather than marking the payment Settled without capturing funds.
            return {
                success: false,
                errorMessage: 'Cannot settle PayPal payment: missing authorizationId in payment metadata',
            };
        }
        const capture = await paypalService.captureAuthorization(ctx, authorizationId);
        if (capture.captureStatus === paypal_server_sdk_1.CaptureStatus.Completed) {
            return {
                success: true,
                metadata: {
                    captureId: capture.captureId,
                    captureStatus: capture.captureStatus,
                },
            };
        }
        core_1.Logger.warn(`PayPal capture ${capture.captureId} for order ${order.code} returned status "${capture.captureStatus}"`, constants_1.loggerCtx);
        return {
            success: false,
            errorMessage: `PayPal capture was not completed (status: ${capture.captureStatus})`,
            metadata: {
                captureId: capture.captureId,
                captureStatus: capture.captureStatus,
            },
        };
    },
});
/**
 * Immediate-capture flow (standard checkout): captures the approved PayPal order
 * and settles the payment in one step.
 */
async function createCapturedPayment(ctx, orderCode, amount, paypalOrderId) {
    const capture = await paypalService.captureOrder(ctx, paypalOrderId);
    const paymentMetadata = {
        paypalOrderId,
        captureId: capture.captureId,
        captureStatus: capture.captureStatus,
        orderStatus: capture.orderStatus,
    };
    if (capture.captureStatus === paypal_server_sdk_1.CaptureStatus.Completed) {
        return {
            amount: capture.amount,
            state: 'Settled',
            transactionId: capture.captureId,
            metadata: paymentMetadata,
        };
    }
    core_1.Logger.warn(`PayPal capture ${capture.captureId} for order ${orderCode} returned status "${capture.captureStatus}"`, constants_1.loggerCtx);
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
async function createAuthorizedPayment(ctx, orderCode, amount, paypalOrderId) {
    const authorization = await paypalService.authorizeOrder(ctx, paypalOrderId);
    const paymentMetadata = {
        paypalOrderId,
        authorizationId: authorization.authorizationId,
        authorizationStatus: authorization.authorizationStatus,
        orderStatus: authorization.orderStatus,
    };
    if (authorization.authorizationStatus === paypal_server_sdk_1.AuthorizationStatus.Created) {
        return {
            amount,
            state: 'Authorized',
            transactionId: authorization.authorizationId,
            metadata: paymentMetadata,
        };
    }
    core_1.Logger.warn(`PayPal authorization ${authorization.authorizationId} for order ${orderCode} returned status "${authorization.authorizationStatus}"`, constants_1.loggerCtx);
    return {
        amount,
        state: 'Declined',
        transactionId: authorization.authorizationId,
        errorMessage: `PayPal authorization was not successful (status: ${authorization.authorizationStatus})`,
        metadata: paymentMetadata,
    };
}
//# sourceMappingURL=paypal.handler.js.map