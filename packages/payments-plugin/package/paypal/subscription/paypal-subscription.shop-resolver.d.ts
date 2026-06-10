import { CustomerService, ID, RequestContext } from '@vendure/core';
import { PayPalSubscriptionService } from './paypal-subscription.service';
import { PayPalSubscriptionResult } from './subscription.types';
export declare class PayPalSubscriptionShopResolver {
    private subscriptionService;
    private customerService;
    constructor(subscriptionService: PayPalSubscriptionService, customerService: CustomerService);
    createPayPalSubscription(ctx: RequestContext, args: {
        planId: ID;
    }): Promise<PayPalSubscriptionResult>;
    activatePayPalSubscription(ctx: RequestContext, args: {
        id: ID;
    }): Promise<PayPalSubscriptionResult>;
    private getActiveCustomer;
}
