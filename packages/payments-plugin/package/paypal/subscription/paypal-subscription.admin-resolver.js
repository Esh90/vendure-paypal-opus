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
exports.PayPalSubscriptionAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const paypal_subscription_service_1 = require("./paypal-subscription.service");
let PayPalSubscriptionAdminResolver = class PayPalSubscriptionAdminResolver {
    constructor(subscriptionService) {
        this.subscriptionService = subscriptionService;
    }
    payPalBillingPlans(ctx) {
        return this.subscriptionService.findAllBillingPlans(ctx);
    }
    payPalSubscriptions(ctx) {
        return this.subscriptionService.findAllSubscriptions(ctx);
    }
    payPalSubscription(ctx, args) {
        return this.subscriptionService.findOneSubscription(ctx, args.id);
    }
    createPayPalBillingPlan(ctx, args) {
        return this.subscriptionService.createBillingPlan(ctx, args.input);
    }
    activatePayPalBillingPlan(ctx, args) {
        return this.subscriptionService.activateBillingPlan(ctx, args.id);
    }
    deactivatePayPalBillingPlan(ctx, args) {
        return this.subscriptionService.deactivateBillingPlan(ctx, args.id);
    }
    updatePayPalBillingPlan(ctx, args) {
        return this.subscriptionService.updateBillingPlan(ctx, args.id, args.input);
    }
    cancelPayPalSubscription(ctx, args) {
        return this.subscriptionService.cancelSubscription(ctx, args.id, args.reason);
    }
    retryPayPalSubscriptionPayment(ctx, args) {
        return this.subscriptionService.retryPayment(ctx, args.id);
    }
    syncPayPalSubscription(ctx, args) {
        return this.subscriptionService.syncSubscription(ctx, args.id);
    }
};
exports.PayPalSubscriptionAdminResolver = PayPalSubscriptionAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "payPalBillingPlans", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "payPalSubscriptions", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "payPalSubscription", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "createPayPalBillingPlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "activatePayPalBillingPlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "deactivatePayPalBillingPlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "updatePayPalBillingPlan", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "cancelPayPalSubscription", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "retryPayPalSubscriptionPayment", null);
__decorate([
    (0, graphql_1.Mutation)(),
    (0, core_1.Allow)(core_1.Permission.UpdateOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalSubscriptionAdminResolver.prototype, "syncPayPalSubscription", null);
exports.PayPalSubscriptionAdminResolver = PayPalSubscriptionAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [paypal_subscription_service_1.PayPalSubscriptionService])
], PayPalSubscriptionAdminResolver);
//# sourceMappingURL=paypal-subscription.admin-resolver.js.map