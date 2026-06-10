import { OrdersController, PaymentsController, SubscriptionsController, TransactionSearchController } from '@paypal/paypal-server-sdk';
import { PayPalPluginOptions } from './types';
/**
 * A thin wrapper around the PayPal Server SDK {@link Client} that pre-instantiates
 * the controllers used by the plugin. The underlying SDK manages the OAuth 2.0
 * access token lifecycle (fetching and refreshing) automatically, so a single
 * instance can be reused for the lifetime of the plugin.
 */
export declare class PayPalClient {
    readonly orders: OrdersController;
    readonly payments: PaymentsController;
    readonly subscriptions: SubscriptionsController;
    readonly transactionSearch: TransactionSearchController;
    constructor(options: PayPalPluginOptions);
}
