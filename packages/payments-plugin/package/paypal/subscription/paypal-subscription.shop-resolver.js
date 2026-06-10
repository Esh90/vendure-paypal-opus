"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalSubscriptionShopResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const paypal_subscription_service_1 = require("./paypal-subscription.service");
let PayPalSubscriptionShopResolver = class PayPalSubscriptionShopResolver {
    constructor(subscriptionService, customerService) {
        this.subscriptionService = subscriptionService;
        this.customerService = customerService;
    }
    async createPayPalSubscription(ctx, args) {
        const customer = await this.getActiveCustomer(ctx);
        return this.subscriptionService.createSubscription(ctx, args.planId, {
            id: customer.id,
            emailAddress: customer.emailAddress,
        });
    }
    async activatePayPalSubscription(ctx, args) {
        var _a;
        const customer = await this.getActiveCustomer(ctx);
        const existing = await this.subscriptionService.findOneSubscription(ctx, args.id);
        if (!existing || existing.customerId !== String(customer.id)) {
            // Do not reveal the existence of subscriptions owned by other customers.
            throw new core_1.UnauthorizedError();
        }
        const subscription = await this.subscriptionService.syncSubscription(ctx, args.id);
        return {
            id: subscription.id,
            paypalSubscriptionId: subscription.paypalSubscriptionId,
            status: subscription.status,
            approveUrl: (_a = subscription.approveUrl) !== null && _a !== void 0 ? _a : undefined,
        };
    }
    async getActiveCustomer(ctx) {
        if (!ctx.activeUserId) {
            throw new core_1.UnauthorizedError();
        }
        const customer = await this.customerService.findOneByUserId(ctx, ctx.activeUserId);
        if (!customer) {
            throw new core_1.UnauthorizedError();
        }
        return customer;
    }
};
exports.PayPalSubscriptionShopResolver = PayPalSubscriptionShopResolver;
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionShopResolver.prototype, "createPayPalSubscription", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.Authenticated),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionShopResolver.prototype, "activatePayPalSubscription", null);
exports.PayPalSubscriptionShopResolver = PayPalSubscriptionShopResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [paypal_subscription_service_1.PayPalSubscriptionService,
        core_1.CustomerService])
], PayPalSubscriptionShopResolver);
//# sourceMappingURL=paypal-subscription.shop-resolver.js.map