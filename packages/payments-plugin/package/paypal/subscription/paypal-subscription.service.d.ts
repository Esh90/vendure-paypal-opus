import { ID, RequestContext, TransactionalConnection } from '@vendure/core';
import { PayPalService } from '../paypal.service';
import { PayPalPluginOptions } from '../types';
import { PayPalBillingPlan } from './paypal-billing-plan.entity';
import { PayPalSubscription } from './paypal-subscription.entity';
import { CreatePayPalBillingPlanInput, PayPalSubscriptionResult, UpdatePayPalBillingPlanInput } from './subscription.types';
export declare class PayPalSubscriptionService {
    private options;
    private connection;
    private paypalService;
    constructor(options: PayPalPluginOptions, connection: TransactionalConnection, paypalService: PayPalService);
    findAllBillingPlans(ctx: RequestContext): Promise<PayPalBillingPlan[]>;
    createBillingPlan(ctx: RequestContext, input: CreatePayPalBillingPlanInput): Promise<PayPalBillingPlan>;
    activateBillingPlan(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan>;
    deactivateBillingPlan(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan>;
    updateBillingPlan(ctx: RequestContext, id: ID, input: UpdatePayPalBillingPlanInput): Promise<PayPalBillingPlan>;
    createSubscription(ctx: RequestContext, planId: ID, customer?: {
        id?: ID;
        emailAddress?: string;
    }): Promise<PayPalSubscriptionResult>;
    findAllSubscriptions(ctx: RequestContext): Promise<PayPalSubscription[]>;
    findOneSubscription(ctx: RequestContext, id: ID): Promise<PayPalSubscription | null>;
    /**
     * Fetches the latest state of a subscription from PayPal and persists the
     * status and failed-payment count into the local entity.
     */
    syncSubscription(ctx: RequestContext, id: ID): Promise<PayPalSubscription>;
    /**
     * Syncs all non-terminal subscriptions from PayPal. Used by the scheduled
     * task for status sync and failure detection.
     */
    syncActiveSubscriptions(ctx: RequestContext): Promise<number>;
    cancelSubscription(ctx: RequestContext, id: ID, reason?: string): Promise<PayPalSubscription>;
    /**
     * Manually captures the outstanding balance of a subscription, used to retry
     * a failed recurring payment.
     */
    retryPayment(ctx: RequestContext, id: ID): Promise<PayPalSubscription>;
    private syncEntity;
    private getBillingPlanOrThrow;
    private getSubscriptionOrThrow;
    /**
     * The PayPal SDK's `Subscription` model schema does not map the `status`
     * field, so it is parsed from the raw JSON response body (a string when
     * `prefer: return=representation` is used).
     */
    private extractRawStatus;
    private client;
    private resolveRedirectUrls;
    private handleApiError;
}
