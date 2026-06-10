import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
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
export declare const paypalPaymentMethodHandler: PaymentMethodHandler<{
    intent: {
        type: "string";
        defaultValue: string;
        label: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
        description: {
            languageCode: LanguageCode.en;
            value: string;
        }[];
        ui: {
            component: string;
            options: {
                value: string;
                label: {
                    languageCode: LanguageCode;
                    value: string;
                }[];
            }[];
        };
    };
}>;
