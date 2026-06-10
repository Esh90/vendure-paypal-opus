import { PluginCommonModule, Type, VendurePlugin } from '@vendure/core';
import { gql } from 'graphql-tag';

import { PAYPAL_PLUGIN_OPTIONS } from './constants';
import { paypalPaymentMethodHandler } from './paypal.handler';
import { PayPalShopResolver } from './paypal.resolver';
import { PayPalService } from './paypal.service';
import { PayPalEnvironment, PayPalPluginOptions } from './types';

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
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [
        {
            provide: PAYPAL_PLUGIN_OPTIONS,
            useFactory: (): PayPalPluginOptions => PayPalPlugin.options,
        },
        PayPalService,
    ],
    configuration: config => {
        config.paymentOptions.paymentMethodHandlers.push(paypalPaymentMethodHandler);
        return config;
    },
    shopApiExtensions: {
        schema: gql`
            type PayPalOrderResult {
                id: String!
                status: String!
                approveUrl: String
            }
            extend type Mutation {
                createPayPalOrder: PayPalOrderResult!
            }
        `,
        resolvers: [PayPalShopResolver],
    },
    exports: [PayPalService],
    compatibility: '^3.0.0',
})
export class PayPalPlugin {
    static options: PayPalPluginOptions;

    /**
     * @description
     * Initialise the PayPal payment plugin. Credentials default to the
     * `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_ENVIRONMENT`
     * environment variables when not provided explicitly.
     */
    static init(options: Partial<PayPalPluginOptions> = {}): Type<PayPalPlugin> {
        const clientId = options.clientId ?? process.env.PAYPAL_CLIENT_ID;
        const clientSecret = options.clientSecret ?? process.env.PAYPAL_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error(
                'PayPalPlugin requires a clientId and clientSecret (set them directly or via the ' +
                    'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables)',
            );
        }
        const environment: PayPalEnvironment =
            options.environment ??
            (process.env.PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox');
        this.options = {
            ...options,
            clientId,
            clientSecret,
            environment,
        };
        return PayPalPlugin;
    }
}
