import { Args, Mutation, Resolver } from '@nestjs/graphql';
import {
    Allow,
    Ctx,
    CustomerService,
    ID,
    Permission,
    RequestContext,
    UnauthorizedError,
} from '@vendure/core';

import { PayPalSubscriptionService } from './paypal-subscription.service';
import { PayPalSubscriptionResult } from './subscription.types';

@Resolver()
export class PayPalSubscriptionShopResolver {
    constructor(
        private subscriptionService: PayPalSubscriptionService,
        private customerService: CustomerService,
    ) {}

    @Mutation()
    @Allow(Permission.Authenticated)
    async createPayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { planId: ID },
    ): Promise<PayPalSubscriptionResult> {
        const customer = await this.getActiveCustomer(ctx);
        return this.subscriptionService.createSubscription(ctx, args.planId, {
            id: customer.id,
            emailAddress: customer.emailAddress,
        });
    }

    @Mutation()
    @Allow(Permission.Authenticated)
    async activatePayPalSubscription(
        @Ctx() ctx: RequestContext,
        @Args() args: { id: ID },
    ): Promise<PayPalSubscriptionResult> {
        const customer = await this.getActiveCustomer(ctx);
        const existing = await this.subscriptionService.findOneSubscription(ctx, args.id);
        if (!existing || existing.customerId !== String(customer.id)) {
            // Do not reveal the existence of subscriptions owned by other customers.
            throw new UnauthorizedError();
        }
        const subscription = await this.subscriptionService.syncSubscription(ctx, args.id);
        return {
            id: subscription.id,
            paypalSubscriptionId: subscription.paypalSubscriptionId,
            status: subscription.status,
            approveUrl: subscription.approveUrl ?? undefined,
        };
    }

    private async getActiveCustomer(ctx: RequestContext) {
        if (!ctx.activeUserId) {
            throw new UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new UnauthorizedError();
        }
        return customer;
    }
}
