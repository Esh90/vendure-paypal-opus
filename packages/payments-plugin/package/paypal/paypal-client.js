"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalClient = void 0;
const paypal_server_sdk_1 = require("@paypal/paypal-server-sdk");
const DEFAULT_API_TIMEOUT = 30000;
/**
 * A thin wrapper around the PayPal Server SDK {@link Client} that pre-instantiates
 * the controllers used by the plugin. The underlying SDK manages the OAuth 2.0
 * access token lifecycle (fetching and refreshing) automatically, so a single
 * instance can be reused for the lifetime of the plugin.
 */
class PayPalClient {
    constructor(options) {
        var _a;
        const client = new paypal_server_sdk_1.Client({
            clientCredentialsAuthCredentials: {
                oAuthClientId: options.clientId,
                oAuthClientSecret: options.clientSecret,
            },
            environment: options.environment === 'production' ? paypal_server_sdk_1.Environment.Production : paypal_server_sdk_1.Environment.Sandbox,
            timeout: (_a = options.apiTimeout) !== null && _a !== void 0 ? _a : DEFAULT_API_TIMEOUT,
            logging: {
                logLevel: paypal_server_sdk_1.LogLevel.Error,
                logRequest: { logBody: false },
                logResponse: { logHeaders: false },
            },
        });
        this.orders = new paypal_server_sdk_1.OrdersController(client);
        this.payments = new paypal_server_sdk_1.PaymentsController(client);
    }
}
exports.PayPalClient = PayPalClient;
//# sourceMappingURL=paypal-client.js.map