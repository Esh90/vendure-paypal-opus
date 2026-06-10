import {
    Client,
    Environment,
    LogLevel,
    OrdersController,
    PaymentsController,
    SubscriptionsController,
} from '@paypal/paypal-server-sdk';

import { PayPalPluginOptions } from './types';

const DEFAULT_API_TIMEOUT = 30_000;

/**
 * A thin wrapper around the PayPal Server SDK {@link Client} that pre-instantiates
 * the controllers used by the plugin. The underlying SDK manages the OAuth 2.0
 * access token lifecycle (fetching and refreshing) automatically, so a single
 * instance can be reused for the lifetime of the plugin.
 */
export class PayPalClient {
    readonly orders: OrdersController;
    readonly payments: PaymentsController;
    readonly subscriptions: SubscriptionsController;

    constructor(options: PayPalPluginOptions) {
        const client = new Client({
            clientCredentialsAuthCredentials: {
                oAuthClientId: options.clientId,
                oAuthClientSecret: options.clientSecret,
            },
            environment:
                options.environment === 'production' ? Environment.Production : Environment.Sandbox,
            timeout: options.apiTimeout ?? DEFAULT_API_TIMEOUT,
            logging: {
                logLevel: LogLevel.Error,
                logRequest: { logBody: false },
                logResponse: { logHeaders: false },
            },
        });
        this.orders = new OrdersController(client);
        this.payments = new PaymentsController(client);
        this.subscriptions = new SubscriptionsController(client);
    }
}
