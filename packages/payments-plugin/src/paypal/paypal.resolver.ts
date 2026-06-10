import { Mutation, Resolver } from '@nestjs/graphql';
import {
    ActiveOrderService,
    Allow,
    Ctx,
    Permission,
    RequestContext,
    UnauthorizedError,
    UserInputError,
} from '@vendure/core';

import { CreatePayPalOrderResult, PayPalService } from './paypal.service';

@Resolver()
export class PayPalShopResolver {
    constructor(
        private paypalService: PayPalService,
        private activeOrderService: ActiveOrderService,
    ) {}

    @Mutation()
    @Allow(Permission.Owner)
    async createPayPalOrder(@Ctx() ctx: RequestContext): Promise<CreatePayPalOrderResult> {
        if (!ctx.authorizedAsOwnerOnly) {
            throw new UnauthorizedError();
        }
        const order = await this.activeOrderService.getActiveOrder(ctx, undefined);
        if (!order) {
            throw new UserInputError('No active order found for session');
        }
        return this.paypalService.createOrder(ctx, order);
    }
}
