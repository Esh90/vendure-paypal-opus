/**
 * @description
 * The PayPal API environment to target. `sandbox` is used for testing with
 * PayPal sandbox accounts, `production` for live transactions.
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage PayPalPlugin
 */
export type PayPalEnvironment = 'sandbox' | 'production';
/**
 * @description
 * The checkout intent configured on the PayPal payment method, which determines
 * how funds are handled when the buyer approves an order:
 *
 * - `'capture'`: funds are captured immediately when the payment is created
 *   (standard checkout).
 * - `'authorize'`: funds are reserved when the payment is created and captured
 *   later, typically on order fulfilment.
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage PayPalPlugin
 */
export type PayPalPaymentIntent = 'capture' | 'authorize';
/**
 * @description
 * Configuration options for the {@link PayPalPlugin}.
 *
 * Credentials are obtained from the PayPal Developer Dashboard
 * (https://developer.paypal.com/dashboard/applications). For server-to-server
 * authentication the plugin uses the OAuth 2.0 Client Credentials flow; access
 * tokens are fetched and refreshed automatically by the PayPal SDK.
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage PayPalPlugin
 */
export interface PayPalPluginOptions {
    /**
     * @description
     * The OAuth client id of your PayPal REST API app. Defaults to the
     * `PAYPAL_CLIENT_ID` environment variable.
     */
    clientId: string;
    /**
     * @description
     * The OAuth client secret of your PayPal REST API app. Defaults to the
     * `PAYPAL_CLIENT_SECRET` environment variable.
     */
    clientSecret: string;
    /**
     * @description
     * Which PayPal environment to target. Defaults to the `PAYPAL_ENVIRONMENT`
     * environment variable, falling back to `'sandbox'`.
     *
     * @default 'sandbox'
     */
    environment?: PayPalEnvironment;
    /**
     * @description
     * The brand name shown to the buyer on the PayPal approval page. If omitted,
     * the PayPal account's business name is used.
     */
    brandName?: string;
    /**
     * @description
     * The URL the buyer is redirected to after approving the payment on PayPal,
     * when using the redirect checkout flow. Not required when using the
     * embedded (Smart Payment Buttons) flow.
     */
    returnUrl?: string;
    /**
     * @description
     * The URL the buyer is redirected to after cancelling the payment on PayPal,
     * when using the redirect checkout flow. Not required when using the
     * embedded (Smart Payment Buttons) flow.
     */
    cancelUrl?: string;
    /**
     * @description
     * Timeout in milliseconds for requests made to the PayPal API. A value of `0`
     * disables the timeout.
     *
     * @default 30000
     */
    apiTimeout?: number;
}
