import { CaptureStatus } from '@paypal/paypal-server-sdk';
import {
    CreatePaymentErrorResult,
    CreatePaymentResult,
    Injector,
    LanguageCode,
    Logger,
    PaymentMethodHandler,
    SettlePaymentResult,
} from '@vendure/core';

import { loggerCtx } from './constants';
import { PayPalService } from './paypal.service';

let paypalService: PayPalService;

/**
 * The handler for PayPal payments.
 *
 * For the standard checkout flow (immediate capture), the buyer first approves a
 * PayPal order created via the `createPayPalOrder` mutation. The storefront then
 * calls the standard `addPaymentToOrder` mutation, passing the approved PayPal
 * order id in `metadata.paypalOrderId`. This handler captures the funds at that
 * point and settles the payment.
 */
export const paypalPaymentMethodHandler = new PaymentMethodHandler({
    code: 'paypal',

    description: [{ languageCode: LanguageCode.en, value: 'PayPal payments' }],

    args: {},

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
        const paypalOrderId = metadata.paypalOrderId;
        if (typeof paypalOrderId !== 'string' || paypalOrderId.length === 0) {
            return {
                amount,
                state: 'Error',
                errorMessage: 'Missing required metadata field "paypalOrderId"',
            };
        }

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
            `PayPal capture ${capture.captureId} for order ${order.code} returned status "${capture.captureStatus}"`,
            loggerCtx,
        );
        return {
            amount: capture.amount,
            state: 'Declined',
            transactionId: capture.captureId,
            errorMessage: `PayPal capture was not completed (status: ${capture.captureStatus})`,
            metadata: paymentMetadata,
        };
    },

    settlePayment(): SettlePaymentResult {
        // Payment is captured during createPayment, so there is nothing further to do.
        return { success: true };
    },
});
