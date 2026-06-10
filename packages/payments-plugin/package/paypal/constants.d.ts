export declare const loggerCtx = "PayPalPlugin";
/**
 * Injection token used to provide the resolved {@link PayPalPluginOptions} to the
 * plugin's providers.
 */
export declare const PAYPAL_PLUGIN_OPTIONS: unique symbol;
/**
 * The `code` of the {@link PaymentMethodHandler} registered by this plugin. A
 * `PaymentMethod` using this handler must be created in the Admin UI for the
 * plugin to be usable.
 */
export declare const PAYPAL_PAYMENT_METHOD_CODE = "paypal";
/**
 * Fallback URLs used for the PayPal buyer-approval redirect flow when the
 * `returnUrl` / `cancelUrl` plugin options are not configured. PayPal requires
 * a redirect target whenever the buyer approves via the hosted (redirect) flow;
 * without one the approval page never completes. These localhost defaults are
 * intended for sandbox/local development only — configure real storefront URLs
 * via {@link PayPalPluginOptions} for production.
 */
export declare const DEFAULT_RETURN_URL = "http://localhost:3000/checkout/paypal/return";
export declare const DEFAULT_CANCEL_URL = "http://localhost:3000/checkout/paypal/cancel";
