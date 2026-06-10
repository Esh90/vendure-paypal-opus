import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext } from '@vendure/core';

import { PayPalBillingPlan } from './paypal-billing-plan.entity';
import { PayPalSubscription } from './paypal-subscription.entity';
import { PayPalSubscriptionService } from './paypal-subscription.service';
import { CreatePayPalBillingPlanInput, UpdatePayPalBillingPlanInput } from './subscription.types';

@Resolver()
export class PayPalSubscriptionAdminResolver {
    constructor(private subscriptionService: PayPalSubscriptionService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    payPalBillingPlans(@Ctx() ctx: RequestContext): Promise<PayPalBillingPlan[]> {
        return this.subscriptionService.findAllBillingPlans(ctx);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    payPalSubscriptions(@Ctx() ctx: RequestContext): Promise<PayPalSubscription[]> {
        return this.subscriptionService.findAllSubscriptions(ctx);
    }

    @Query()
    @Allow(Permission.ReadOrder)
    payPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<PayPalSubscription | null> {
        return this.subscriptionService.findOneSubscription(ctx, args.id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    createPayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() args: { input: CreatePayPalBillingPlanInput },
    ): Promise<PayPalBillingPlan> {
        return this.subscriptionService.createBillingPlan(ctx, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    activatePayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<PayPalBillingPlan> {
        return this.subscriptionService.activateBillingPlan(ctx, args.id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    deactivatePayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<PayPalBillingPlan> {
        return this.subscriptionService.deactivateBillingPlan(ctx, args.id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    updatePayPalBillingPlan(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID; input: UpdatePayPalBillingPlanInput },
    ): Promise<PayPalBillingPlan> {
        return this.subscriptionService.updateBillingPlan(ctx, args.id, args.input);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    cancelPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID; reason?: string },
    ): Promise<PayPalSubscription> {
        return this.subscriptionService.cancelSubscription(ctx, args.id, args.reason);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    retryPayPalSubscriptionPayment(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<PayPalSubscription> {
        return this.subscriptionService.retryPayment(ctx, args.id);
    }

    @Mutation()
    @Allow(Permission.UpdateOrder)
    syncPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<PayPalSubscription> {
        return this.subscriptionService.syncSubscription(ctx, args.id);
    }
}
