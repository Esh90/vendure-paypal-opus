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
exports.PayPalSubscriptionService = void 0;
const common_1 = require("@nestjs/common");
const paypal_server_sdk_1 = require("@paypal/paypal-server-sdk");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const paypal_utils_1 = require("../paypal-utils");
const paypal_service_1 = require("../paypal.service");
const paypal_billing_plan_entity_1 = require("./paypal-billing-plan.entity");
const paypal_subscription_entity_1 = require("./paypal-subscription.entity");
/** PayPal subscription statuses that are terminal and no longer need syncing. */
const TERMINAL_SUBSCRIPTION_STATUSES = ['CANCELLED', 'EXPIRED'];
let PayPalSubscriptionService = class PayPalSubscriptionService {
    constructor(options, connection, paypalService) {
        this.options = options;
        this.connection = connection;
        this.paypalService = paypalService;
    }
    // --- Billing plan lifecycle (merchant) -------------------------------------
    async findAllBillingPlans(ctx) {
        return this.connection.getRepository(ctx, paypal_billing_plan_entity_1.PayPalBillingPlan).find({ order: { createdAt: 'DESC' } });
    }
    async createBillingPlan(ctx, input) {
        var _a, _b, _c, _d, _e;
        const { returnUrl, cancelUrl } = this.resolveRedirectUrls();
        try {
            const { result } = await this.client().subscriptions.createBillingPlan({
                prefer: 'return=representation',
                body: {
                    productId: input.productId,
                    name: input.name,
                    description: input.description,
                    // Created as CREATED so the merchant explicitly activates it.
                    status: paypal_server_sdk_1.PlanRequestStatus.Created,
                    billingCycles: [
                        {
                            frequency: {
                                intervalUnit: input.intervalUnit,
                                intervalCount: input.intervalCount,
                            },
                            tenureType: paypal_server_sdk_1.TenureType.Regular,
                            sequence: 1,
                            totalCycles: (_a = input.totalCycles) !== null && _a !== void 0 ? _a : 0,
                            pricingScheme: {
                                fixedPrice: {
                                    value: (0, paypal_utils_1.toPayPalAmount)(input.priceAmount, input.currencyCode),
                                    currencyCode: input.currencyCode,
                                },
                            },
                        },
                    ],
                    paymentPreferences: {
                        autoBillOutstanding: true,
                        paymentFailureThreshold: (_b = input.paymentFailureThreshold) !== null && _b !== void 0 ? _b : 0,
                    },
                    merchantPreferences: { returnUrl, cancelUrl },
                },
            });
            if (!result.id) {
                throw new core_1.InternalServerError('PayPal did not return a billing plan id');
            }
            const plan = new paypal_billing_plan_entity_1.PayPalBillingPlan({
                paypalPlanId: result.id,
                paypalProductId: input.productId,
                name: input.name,
                description: input.description,
                intervalUnit: input.intervalUnit,
                intervalCount: input.intervalCount,
                totalCycles: (_c = input.totalCycles) !== null && _c !== void 0 ? _c : 0,
                priceAmount: input.priceAmount,
                currencyCode: input.currencyCode,
                paymentFailureThreshold: (_d = input.paymentFailureThreshold) !== null && _d !== void 0 ? _d : 0,
                status: (_e = result.status) !== null && _e !== void 0 ? _e : 'CREATED',
            });
            return this.connection.getRepository(ctx, paypal_billing_plan_entity_1.PayPalBillingPlan).save(plan);
        }
        catch (e) {
            throw this.handleApiError(e, 'Failed to create PayPal billing plan');
        }
    }
    async activateBillingPlan(ctx, id) {
        const plan = await this.getBillingPlanOrThrow(ctx, id);
        try {
            await this.client().subscriptions.activateBillingPlan(plan.paypalPlanId);
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to activate PayPal billing plan ${plan.paypalPlanId}`);
        }
        plan.status = 'ACTIVE';
        return this.connection.getRepository(ctx, paypal_billing_plan_entity_1.PayPalBillingPlan).save(plan);
    }
    async deactivateBillingPlan(ctx, id) {
        const plan = await this.getBillingPlanOrThrow(ctx, id);
        try {
            await this.client().subscriptions.deactivateBillingPlan(plan.paypalPlanId);
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to deactivate PayPal billing plan ${plan.paypalPlanId}`);
        }
        plan.status = 'INACTIVE';
        return this.connection.getRepository(ctx, paypal_billing_plan_entity_1.PayPalBillingPlan).save(plan);
    }
    async updateBillingPlan(ctx, id, input) {
        const plan = await this.getBillingPlanOrThrow(ctx, id);
        try {
            if (input.paymentFailureThreshold != null) {
                await this.client().subscriptions.patchBillingPlan({
                    id: plan.paypalPlanId,
                    body: [
                        {
                            op: paypal_server_sdk_1.PatchOp.Replace,
                            path: '/payment_preferences/payment_failure_threshold',
                            value: input.paymentFailureThreshold,
                        },
                    ],
                });
                plan.paymentFailureThreshold = input.paymentFailureThreshold;
            }
            if (input.priceAmount != null) {
                await this.client().subscriptions.updateBillingPlanPricingSchemes({
                    id: plan.paypalPlanId,
                    body: {
                        pricingSchemes: [
                            {
                                billingCycleSequence: 1,
                                pricingScheme: {
                                    fixedPrice: {
                                        value: (0, paypal_utils_1.toPayPalAmount)(input.priceAmount, plan.currencyCode),
                                        currencyCode: plan.currencyCode,
                                    },
                                },
                            },
                        ],
                    },
                });
                plan.priceAmount = input.priceAmount;
            }
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to update PayPal billing plan ${plan.paypalPlanId}`);
        }
        return this.connection.getRepository(ctx, paypal_billing_plan_entity_1.PayPalBillingPlan).save(plan);
    }
    // --- Subscription lifecycle (customer + merchant) --------------------------
    async createSubscription(ctx, planId, customer) {
        var _a, _b, _c;
        const plan = await this.getBillingPlanOrThrow(ctx, planId);
        if (plan.status !== 'ACTIVE') {
            throw new core_1.UserInputError(`PayPal billing plan ${plan.id} is not active`);
        }
        try {
            const { result, body } = await this.client().subscriptions.createSubscription({
                prefer: 'return=representation',
                body: {
                    planId: plan.paypalPlanId,
                    subscriber: (customer === null || customer === void 0 ? void 0 : customer.emailAddress)
                        ? { emailAddress: customer.emailAddress }
                        : undefined,
                },
            });
            if (!result.id) {
                throw new core_1.InternalServerError('PayPal did not return a subscription id');
            }
            const approveUrl = (_b = (_a = result.links) === null || _a === void 0 ? void 0 : _a.find(link => link.rel === 'approve' || link.rel === 'payer-action')) === null || _b === void 0 ? void 0 : _b.href;
            const status = (_c = this.extractRawStatus(body)) !== null && _c !== void 0 ? _c : 'APPROVAL_PENDING';
            const subscription = new paypal_subscription_entity_1.PayPalSubscription({
                paypalSubscriptionId: result.id,
                paypalPlanId: plan.paypalPlanId,
                status,
                approveUrl: approveUrl !== null && approveUrl !== void 0 ? approveUrl : null,
                customerEmail: customer === null || customer === void 0 ? void 0 : customer.emailAddress,
                customerId: (customer === null || customer === void 0 ? void 0 : customer.id) != null ? String(customer.id) : undefined,
                failedPaymentsCount: 0,
                lastSyncedAt: null,
            });
            const saved = await this.connection
                .getRepository(ctx, paypal_subscription_entity_1.PayPalSubscription)
                .save(subscription);
            return {
                id: saved.id,
                paypalSubscriptionId: saved.paypalSubscriptionId,
                status: saved.status,
                approveUrl: approveUrl,
            };
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to create PayPal subscription for plan ${plan.id}`);
        }
    }
    async findAllSubscriptions(ctx) {
        return this.connection
            .getRepository(ctx, paypal_subscription_entity_1.PayPalSubscription)
            .find({ order: { createdAt: 'DESC' } });
    }
    async findOneSubscription(ctx, id) {
        return this.connection.getRepository(ctx, paypal_subscription_entity_1.PayPalSubscription).findOne({ where: { id: id } });
    }
    /**
     * Fetches the latest state of a subscription from PayPal and persists the
     * status and failed-payment count into the local entity.
     */
    async syncSubscription(ctx, id) {
        const subscription = await this.getSubscriptionOrThrow(ctx, id);
        return this.syncEntity(ctx, subscription);
    }
    /**
     * Syncs all non-terminal subscriptions from PayPal. Used by the scheduled
     * task for status sync and failure detection.
     */
    async syncActiveSubscriptions(ctx) {
        const subscriptions = await this.connection.getRepository(ctx, paypal_subscription_entity_1.PayPalSubscription).find();
        const toSync = subscriptions.filter(s => !TERMINAL_SUBSCRIPTION_STATUSES.includes(s.status));
        let synced = 0;
        for (const subscription of toSync) {
            try {
                await this.syncEntity(ctx, subscription);
                synced++;
            }
            catch (e) {
                core_1.Logger.error(`Failed to sync PayPal subscription ${subscription.paypalSubscriptionId}: ${e instanceof Error ? e.message : String(e)}`, constants_1.loggerCtx);
            }
        }
        return synced;
    }
    async cancelSubscription(ctx, id, reason) {
        const subscription = await this.getSubscriptionOrThrow(ctx, id);
        try {
            await this.client().subscriptions.cancelSubscription({
                id: subscription.paypalSubscriptionId,
                body: { reason: reason !== null && reason !== void 0 ? reason : 'Cancelled by merchant' },
            });
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to cancel PayPal subscription ${subscription.paypalSubscriptionId}`);
        }
        subscription.status = 'CANCELLED';
        subscription.lastSyncedAt = new Date();
        return this.connection.getRepository(ctx, paypal_subscription_entity_1.PayPalSubscription).save(subscription);
    }
    /**
     * Manually captures the outstanding balance of a subscription, used to retry
     * a failed recurring payment.
     */
    async retryPayment(ctx, id) {
        var _a;
        const subscription = await this.getSubscriptionOrThrow(ctx, id);
        try {
            const { result } = await this.client().subscriptions.getSubscription({
                id: subscription.paypalSubscriptionId,
            });
            const outstanding = (_a = result.billingInfo) === null || _a === void 0 ? void 0 : _a.outstandingBalance;
            if (!(outstanding === null || outstanding === void 0 ? void 0 : outstanding.value) || !outstanding.currencyCode || Number(outstanding.value) <= 0) {
                throw new core_1.UserInputError(`Subscription ${subscription.paypalSubscriptionId} has no outstanding balance to capture`);
            }
            await this.client().subscriptions.captureSubscription({
                id: subscription.paypalSubscriptionId,
                body: {
                    note: 'Retry of failed subscription payment',
                    captureType: paypal_server_sdk_1.CaptureType.OutstandingBalance,
                    amount: { value: outstanding.value, currencyCode: outstanding.currencyCode },
                },
            });
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to retry payment for PayPal subscription ${subscription.paypalSubscriptionId}`);
        }
        return this.syncEntity(ctx, subscription);
    }
    // --- Internal helpers ------------------------------------------------------
    async syncEntity(ctx, subscription) {
        var _a, _b;
        try {
            const { result, body } = await this.client().subscriptions.getSubscription({
                id: subscription.paypalSubscriptionId,
            });
            const status = this.extractRawStatus(body);
            if (status) {
                subscription.status = status;
            }
            subscription.failedPaymentsCount = (_b = (_a = result.billingInfo) === null || _a === void 0 ? void 0 : _a.failedPaymentsCount) !== null && _b !== void 0 ? _b : 0;
            subscription.lastSyncedAt = new Date();
            if (subscription.failedPaymentsCount > 0 || status === 'SUSPENDED') {
                core_1.Logger.warn(`PayPal subscription ${subscription.paypalSubscriptionId} status="${status}" ` +
                    `failedPayments=${subscription.failedPaymentsCount}`, constants_1.loggerCtx);
            }
            return this.connection.getRepository(ctx, paypal_subscription_entity_1.PayPalSubscription).save(subscription);
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to sync PayPal subscription ${subscription.paypalSubscriptionId}`);
        }
    }
    async getBillingPlanOrThrow(ctx, id) {
        const plan = await this.connection
            .getRepository(ctx, paypal_billing_plan_entity_1.PayPalBillingPlan)
            .findOne({ where: { id: id } });
        if (!plan) {
            throw new core_1.EntityNotFoundError('PayPalBillingPlan', id);
        }
        return plan;
    }
    async getSubscriptionOrThrow(ctx, id) {
        const subscription = await this.findOneSubscription(ctx, id);
        if (!subscription) {
            throw new core_1.EntityNotFoundError('PayPalSubscription', id);
        }
        return subscription;
    }
    /**
     * The PayPal SDK's `Subscription` model schema does not map the `status`
     * field, so it is parsed from the raw JSON response body (a string when
     * `prefer: return=representation` is used).
     */
    extractRawStatus(body) {
        if (typeof body !== 'string' || body.length === 0) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(body);
            return typeof parsed.status === 'string' ? parsed.status : undefined;
        }
        catch (_a) {
            return undefined;
        }
    }
    client() {
        return this.paypalService.getClient();
    }
    resolveRedirectUrls() {
        var _a, _b;
        return {
            returnUrl: (_a = this.options.returnUrl) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_RETURN_URL,
            cancelUrl: (_b = this.options.cancelUrl) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_CANCEL_URL,
        };
    }
    handleApiError(e, context) {
        var _a;
        if (e instanceof paypal_server_sdk_1.ApiError) {
            const detail = typeof e.body === 'string' ? e.body : JSON.stringify((_a = e.result) !== null && _a !== void 0 ? _a : e.message);
            core_1.Logger.error(`${context}: [${e.statusCode}] ${detail}`, constants_1.loggerCtx);
            return new core_1.InternalServerError(`${context} (PayPal error ${e.statusCode})`);
        }
        if (e instanceof core_1.UserInputError || e instanceof core_1.InternalServerError || e instanceof core_1.EntityNotFoundError) {
            return e;
        }
        const message = e instanceof Error ? e.message : String(e);
        core_1.Logger.error(`${context}: ${message}`, constants_1.loggerCtx);
        return new core_1.InternalServerError(context);
    }
};
exports.PayPalSubscriptionService = PayPalSubscriptionService;
exports.PayPalSubscriptionService = PayPalSubscriptionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.PAYPAL_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.TransactionalConnection,
        paypal_service_1.PayPalService])
], PayPalSubscriptionService);
//# sourceMappingURL=paypal-subscription.service.js.map