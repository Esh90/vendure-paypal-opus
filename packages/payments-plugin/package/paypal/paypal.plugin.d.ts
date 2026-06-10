import { Type } from '@vendure/core';
import { PayPalPluginOptions } from './types';
/**
 * @description
 * Plugin to enable payments through [PayPal](https://developer.paypal.com/) using
 * the PayPal Server SDK.
 *
 * ## Requirements
 *
 * 1. Create a PayPal REST API app in the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
 *    to obtain a client id and secret.
 * 2. Install the Payments plugin and the PayPal Server SDK:
 *
 *     `npm install \@vendure/payments-plugin \@paypal/paypal-server-sdk`
 *
 * ## Setup
 *
 * 1. Add the plugin to your VendureConfig `plugins` array:
 *     ```ts
 *     import { PayPalPlugin } from '\@vendure/payments-plugin/package/paypal';
 *
 *     plugins: [
 *       PayPalPlugin.init({
 *         clientId: process.env.PAYPAL_CLIENT_ID,
 *         clientSecret: process.env.PAYPAL_CLIENT_SECRET,
 *         environment: 'sandbox',
 *       }),
 *     ],
 *     ```
 * 2. Create a new PaymentMethod in the Admin UI, and select "PayPal payments" as the handler.
 *
 * ## Storefront usage (standard checkout, immediate capture)
 *
 * 1. With the order in the `ArrangingPayment` state, call the `createPayPalOrder` mutation
 *    exposed by this plugin. It returns the PayPal order `id`, its `status` and (for the
 *    redirect flow) an `approveUrl`.
 * 2. Direct the buyer to approve the payment, either by redirecting to `approveUrl` or by
 *    using the PayPal JS SDK (Smart Payment Buttons) with the returned order `id`.
 * 3. After the buyer approves, complete the payment with the standard `addPaymentToOrder`
 *    mutation, passing the approved PayPal order id:
 *     ```graphql
 *     mutation {
 *       addPaymentToOrder(input: {
 *         method: "paypal",
 *         metadata: { paypalOrderId: "<the PayPal order id>" }
 *       }) {
 *         ... on Order { id state }
 *         ... on ErrorResult { errorCode message }
 *       }
 *     }
 *     ```
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage PayPalPlugin
 */
export declare class PayPalPlugin {
    static options: PayPalPluginOptions;
    /**
     * @description
     * Initialise the PayPal payment plugin. Credentials default to the
     * `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_ENVIRONMENT`
     * environment variables when not provided explicitly.
     */
    static init(options?: Partial<PayPalPluginOptions>): Type<PayPalPlugin>;
}
