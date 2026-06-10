"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CANCEL_URL = exports.DEFAULT_RETURN_URL = exports.PAYPAL_PAYMENT_METHOD_CODE = exports.PAYPAL_PLUGIN_OPTIONS = exports.loggerCtx = void 0;
exports.loggerCtx = 'PayPalPlugin';
/**
 * Injection token used to provide the resolved {@link PayPalPluginOptions} to the
 * plugin's providers.
 */
exports.PAYPAL_PLUGIN_OPTIONS = Symbol('PAYPAL_PLUGIN_OPTIONS');
/**
 * The `code` of the {@link PaymentMethodHandler} registered by this plugin. A
 * `PaymentMethod` using this handler must be created in the Admin UI for the
 * plugin to be usable.
 */
exports.PAYPAL_PAYMENT_METHOD_CODE = 'paypal';
/**
 * Fallback URLs used for the PayPal buyer-approval redirect flow when the
 * `returnUrl` / `cancelUrl` plugin options are not configured. PayPal requires
 * a redirect target whenever the buyer approves via the hosted (redirect) flow;
 * without one the approval page never completes. These localhost defaults are
 * intended for sandbox/local development only — configure real storefront URLs
 * via {@link PayPalPluginOptions} for production.
 */
exports.DEFAULT_RETURN_URL = 'http://localhost:3000/checkout/paypal/return';
exports.DEFAULT_CANCEL_URL = 'http://localhost:3000/checkout/paypal/cancel';
//# sourceMappingURL=constants.js.map