import { ID, RequestContext } from '@vendure/core';
import { PayPalBillingPlan } from './paypal-billing-plan.entity';
import { PayPalSubscription } from './paypal-subscription.entity';
import { PayPalSubscriptionService } from './paypal-subscription.service';
import { CreatePayPalBillingPlanInput, UpdatePayPalBillingPlanInput } from './subscription.types';
export declare class PayPalSubscriptionAdminResolver {
    private subscriptionService;
    constructor(subscriptionService: PayPalSubscriptionService);
    payPalBillingPlans(ctx: RequestContext): Promise<PayPalBillingPlan[]>;
    payPalSubscriptions(ctx: RequestContext): Promise<PayPalSubscription[]>;
    payPalSubscription(ctx: RequestContext, args: {
        id: ID;
    }): Promise<PayPalSubscription | null>;
    createPayPalBillingPlan(ctx: RequestContext, args: {
        input: CreatePayPalBillingPlanInput;
    }): Promise<PayPalBillingPlan>;
    activatePayPalBillingPlan(ctx: RequestContext, args: {
        id: ID;
    }): Promise<PayPalBillingPlan>;
    deactivatePayPalBillingPlan(ctx: RequestContext, args: {
        id: ID;
    }): Promise<PayPalBillingPlan>;
    updatePayPalBillingPlan(ctx: RequestContext, args: {
        id: ID;
        input: UpdatePayPalBillingPlanInput;
    }): Promise<PayPalBillingPlan>;
    cancelPayPalSubscription(ctx: RequestContext, args: {
        id: ID;
        reason?: string;
    }): Promise<PayPalSubscription>;
    retryPayPalSubscriptionPayment(ctx: RequestContext, args: {
        id: ID;
    }): Promise<PayPalSubscription>;
    syncPayPalSubscription(ctx: RequestContext, args: {
        id: ID;
    }): Promise<PayPalSubscription>;
}
