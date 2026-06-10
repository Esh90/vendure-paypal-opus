import { Inject, Injectable } from '@nestjs/common';
import {
    ApiError,
    CaptureType,
    IntervalUnit,
    PatchOp,
    PlanRequestStatus,
    TenureType,
} from '@paypal/paypal-server-sdk';
import {
    EntityNotFoundError,
    ID,
    InternalServerError,
    Logger,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { DEFAULT_CANCEL_URL, DEFAULT_RETURN_URL, loggerCtx, PAYPAL_PLUGIN_OPTIONS } from '../constants';
import { PayPalClient } from '../paypal-client';
import { toPayPalAmount } from '../paypal-utils';
import { PayPalService } from '../paypal.service';
import { PayPalPluginOptions } from '../types';

import { PayPalBillingPlan } from './paypal-billing-plan.entity';
import { PayPalSubscription } from './paypal-subscription.entity';
import {
    CreatePayPalBillingPlanInput,
    PayPalSubscriptionResult,
    UpdatePayPalBillingPlanInput,
} from './subscription.types';

/** PayPal subscription statuses that are terminal and no longer need syncing. */
const TERMINAL_SUBSCRIPTION_STATUSES = ['CANCELLED', 'EXPIRED'];

@Injectable()
export class PayPalSubscriptionService {
    constructor(
        @Inject(PAYPAL_PLUGIN_OPTIONS) private options: PayPalPluginOptions,
        private connection: TransactionalConnection,
        private paypalService: PayPalService,
    ) {}

    // --- Billing plan lifecycle (merchant) -------------------------------------

    async findAllBillingPlans(ctx: RequestContext): Promise<PayPalBillingPlan[]> {
        return this.connection.getRepository(ctx, PayPalBillingPlan).find({ order: { createdAt: 'DESC' } });
    }

    async createBillingPlan(
        ctx: RequestContext,
        input: CreatePayPalBillingPlanInput,
    ): Promise<PayPalBillingPlan> {
        const { returnUrl, cancelUrl } = this.resolveRedirectUrls();
        try {
            const { result } = await this.client().subscriptions.createBillingPlan({
                prefer: 'return=representation',
                body: {
                    productId: input.productId,
                    name: input.name,
                    description: input.description,
                    // Created as CREATED so the merchant explicitly activates it.
                    status: PlanRequestStatus.Created,
                    billingCycles: [
                        {
                            frequency: {
                                intervalUnit: input.intervalUnit as IntervalUnit,
                                intervalCount: input.intervalCount,
                            },
                            tenureType: TenureType.Regular,
                            sequence: 1,
                            totalCycles: input.totalCycles ?? 0,
                            pricingScheme: {
                                fixedPrice: {
                                    value: toPayPalAmount(input.priceAmount, input.currencyCode),
                                    currencyCode: input.currencyCode,
                                },
                            },
                        },
                    ],
                    paymentPreferences: {
                        autoBillOutstanding: true,
                        paymentFailureThreshold: input.paymentFailureThreshold ?? 0,
                    },
                    merchantPreferences: { returnUrl, cancelUrl },
                },
            });

            if (!result.id) {
                throw new InternalServerError('PayPal did not return a billing plan id');
            }

            const plan = new PayPalBillingPlan({
                paypalPlanId: result.id,
                paypalProductId: input.productId,
                name: input.name,
                description: input.description,
                intervalUnit: input.intervalUnit,
                intervalCount: input.intervalCount,
                totalCycles: input.totalCycles ?? 0,
                priceAmount: input.priceAmount,
                currencyCode: input.currencyCode,
                paymentFailureThreshold: input.paymentFailureThreshold ?? 0,
                status: result.status ?? 'CREATED',
            });
            return this.connection.getRepository(ctx, PayPalBillingPlan).save(plan);
        } catch (e) {
            throw this.handleApiError(e, 'Failed to create PayPal billing plan');
        }
    }

    async activateBillingPlan(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan> {
        const plan = await this.getBillingPlanOrThrow(ctx, id);
        try {
            await this.client().subscriptions.activateBillingPlan(plan.paypalPlanId);
        } catch (e) {
            throw this.handleApiError(e, `Failed to activate PayPal billing plan ${plan.paypalPlanId}`);
        }
        plan.status = 'ACTIVE';
        return this.connection.getRepository(ctx, PayPalBillingPlan).save(plan);
    }

    async deactivateBillingPlan(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan> {
        const plan = await this.getBillingPlanOrThrow(ctx, id);
        try {
            await this.client().subscriptions.deactivateBillingPlan(plan.paypalPlanId);
        } catch (e) {
            throw this.handleApiError(e, `Failed to deactivate PayPal billing plan ${plan.paypalPlanId}`);
        }
        plan.status = 'INACTIVE';
        return this.connection.getRepository(ctx, PayPalBillingPlan).save(plan);
    }

    async updateBillingPlan(
        ctx: RequestContext,
        id: ID,
        input: UpdatePayPalBillingPlanInput,
    ): Promise<PayPalBillingPlan> {
        const plan = await this.getBillingPlanOrThrow(ctx, id);
        try {
            if (input.paymentFailureThreshold != null) {
                await this.client().subscriptions.patchBillingPlan({
                    id: plan.paypalPlanId,
                    body: [
                        {
                            op: PatchOp.Replace,
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
                                        value: toPayPalAmount(input.priceAmount, plan.currencyCode),
                                        currencyCode: plan.currencyCode,
                                    },
                                },
                            },
                        ],
                    },
                });
                plan.priceAmount = input.priceAmount;
            }
        } catch (e) {
            throw this.handleApiError(e, `Failed to update PayPal billing plan ${plan.paypalPlanId}`);
        }
        return this.connection.getRepository(ctx, PayPalBillingPlan).save(plan);
    }

    // --- Subscription lifecycle (customer + merchant) --------------------------

    async createSubscription(
        ctx: RequestContext,
        planId: ID,
        customer?: { id?: ID; emailAddress?: string },
    ): Promise<PayPalSubscriptionResult> {
        const plan = await this.getBillingPlanOrThrow(ctx, planId);
        if (plan.status !== 'ACTIVE') {
            throw new UserInputError(`PayPal billing plan ${plan.id} is not active`);
        }
        try {
            const { result, body } = await this.client().subscriptions.createSubscription({
                prefer: 'return=representation',
                body: {
                    planId: plan.paypalPlanId,
                    subscriber: customer?.emailAddress
                        ? { emailAddress: customer.emailAddress }
                        : undefined,
                },
            });

            if (!result.id) {
                throw new InternalServerError('PayPal did not return a subscription id');
            }
            const approveUrl = result.links?.find(
                link => link.rel === 'approve' || link.rel === 'payer-action',
            )?.href;
            const status = this.extractRawStatus(body) ?? 'APPROVAL_PENDING';

            const subscription = new PayPalSubscription({
                paypalSubscriptionId: result.id,
                paypalPlanId: plan.paypalPlanId,
                status,
                approveUrl: approveUrl ?? null,
                customerEmail: customer?.emailAddress,
                customerId: customer?.id != null ? String(customer.id) : undefined,
                failedPaymentsCount: 0,
                lastSyncedAt: null,
            });
            const saved = await this.connection
                .getRepository(ctx, PayPalSubscription)
                .save(subscription);

            return {
                id: saved.id,
                paypalSubscriptionId: saved.paypalSubscriptionId,
                status: saved.status,
                approveUrl: approveUrl,
            };
        } catch (e) {
            throw this.handleApiError(e, `Failed to create PayPal subscription for plan ${plan.id}`);
        }
    }

    async findAllSubscriptions(ctx: RequestContext): Promise<PayPalSubscription[]> {
        return this.connection
            .getRepository(ctx, PayPalSubscription)
            .find({ order: { createdAt: 'DESC' } });
    }

    async findOneSubscription(ctx: RequestContext, id: ID): Promise<PayPalSubscription | null> {
        return this.connection.getRepository(ctx, PayPalSubscription).findOne({ where: { id: id as any } });
    }

    /**
     * Fetches the latest state of a subscription from PayPal and persists the
     * status and failed-payment count into the local entity.
     */
    async syncSubscription(ctx: RequestContext, id: ID): Promise<PayPalSubscription> {
        const subscription = await this.getSubscriptionOrThrow(ctx, id);
        return this.syncEntity(ctx, subscription);
    }

    /**
     * Syncs all non-terminal subscriptions from PayPal. Used by the scheduled
     * task for status sync and failure detection.
     */
    async syncActiveSubscriptions(ctx: RequestContext): Promise<number> {
        const subscriptions = await this.connection.getRepository(ctx, PayPalSubscription).find();
        const toSync = subscriptions.filter(s => !TERMINAL_SUBSCRIPTION_STATUSES.includes(s.status));
        let synced = 0;
        for (const subscription of toSync) {
            try {
                await this.syncEntity(ctx, subscription);
                synced++;
            } catch (e) {
                Logger.error(
                    `Failed to sync PayPal subscription ${subscription.paypalSubscriptionId}: ${
                        e instanceof Error ? e.message : String(e)
                    }`,
                    loggerCtx,
                );
            }
        }
        return synced;
    }

    async cancelSubscription(ctx: RequestContext, id: ID, reason?: string): Promise<PayPalSubscription> {
        const subscription = await this.getSubscriptionOrThrow(ctx, id);
        try {
            await this.client().subscriptions.cancelSubscription({
                id: subscription.paypalSubscriptionId,
                body: { reason: reason ?? 'Cancelled by merchant' },
            });
        } catch (e) {
            throw this.handleApiError(
                e,
                `Failed to cancel PayPal subscription ${subscription.paypalSubscriptionId}`,
            );
        }
        subscription.status = 'CANCELLED';
        subscription.lastSyncedAt = new Date();
        return this.connection.getRepository(ctx, PayPalSubscription).save(subscription);
    }

    /**
     * Manually captures the outstanding balance of a subscription, used to retry
     * a failed recurring payment.
     */
    async retryPayment(ctx: RequestContext, id: ID): Promise<PayPalSubscription> {
        const subscription = await this.getSubscriptionOrThrow(ctx, id);
        try {
            const { result } = await this.client().subscriptions.getSubscription({
                id: subscription.paypalSubscriptionId,
            });
            const outstanding = result.billingInfo?.outstandingBalance;
            if (!outstanding?.value || !outstanding.currencyCode || Number(outstanding.value) <= 0) {
                throw new UserInputError(
                    `Subscription ${subscription.paypalSubscriptionId} has no outstanding balance to capture`,
                );
            }
            await this.client().subscriptions.captureSubscription({
                id: subscription.paypalSubscriptionId,
                body: {
                    note: 'Retry of failed subscription payment',
                    captureType: CaptureType.OutstandingBalance,
                    amount: { value: outstanding.value, currencyCode: outstanding.currencyCode },
                },
            });
        } catch (e) {
            throw this.handleApiError(
                e,
                `Failed to retry payment for PayPal subscription ${subscription.paypalSubscriptionId}`,
            );
        }
        return this.syncEntity(ctx, subscription);
    }

    // --- Internal helpers ------------------------------------------------------

    private async syncEntity(
        ctx: RequestContext,
        subscription: PayPalSubscription,
    ): Promise<PayPalSubscription> {
        try {
            const { result, body } = await this.client().subscriptions.getSubscription({
                id: subscription.paypalSubscriptionId,
            });
            const status = this.extractRawStatus(body);
            if (status) {
                subscription.status = status;
            }
            subscription.failedPaymentsCount = result.billingInfo?.failedPaymentsCount ?? 0;
            subscription.lastSyncedAt = new Date();
            if (subscription.failedPaymentsCount > 0 || status === 'SUSPENDED') {
                Logger.warn(
                    `PayPal subscription ${subscription.paypalSubscriptionId} status="${status}" ` +
                        `failedPayments=${subscription.failedPaymentsCount}`,
                    loggerCtx,
                );
            }
            return this.connection.getRepository(ctx, PayPalSubscription).save(subscription);
        } catch (e) {
            throw this.handleApiError(
                e,
                `Failed to sync PayPal subscription ${subscription.paypalSubscriptionId}`,
            );
        }
    }

    private async getBillingPlanOrThrow(ctx: RequestContext, id: ID): Promise<PayPalBillingPlan> {
        const plan = await this.connection
            .getRepository(ctx, PayPalBillingPlan)
            .findOne({ where: { id: id as any } });
        if (!plan) {
            throw new EntityNotFoundError('PayPalBillingPlan' as any, id);
        }
        return plan;
    }

    private async getSubscriptionOrThrow(ctx: RequestContext, id: ID): Promise<PayPalSubscription> {
        const subscription = await this.findOneSubscription(ctx, id);
        if (!subscription) {
            throw new EntityNotFoundError('PayPalSubscription' as any, id);
        }
        return subscription;
    }

    /**
     * The PayPal SDK's `Subscription` model schema does not map the `status`
     * field, so it is parsed from the raw JSON response body (a string when
     * `prefer: return=representation` is used).
     */
    private extractRawStatus(body: unknown): string | undefined {
        if (typeof body !== 'string' || body.length === 0) {
            return undefined;
        }
        try {
            const parsed = JSON.parse(body) as { status?: unknown };
            return typeof parsed.status === 'string' ? parsed.status : undefined;
        } catch {
            return undefined;
        }
    }

    private client(): PayPalClient {
        return this.paypalService.getClient();
    }

    private resolveRedirectUrls(): { returnUrl: string; cancelUrl: string } {
        return {
            returnUrl: this.options.returnUrl ?? DEFAULT_RETURN_URL,
            cancelUrl: this.options.cancelUrl ?? DEFAULT_CANCEL_URL,
        };
    }

    private handleApiError(e: unknown, context: string): Error {
        if (e instanceof ApiError) {
            const detail = typeof e.body === 'string' ? e.body : JSON.stringify(e.result ?? e.message);
            Logger.error(`${context}: [${e.statusCode}] ${detail}`, loggerCtx);
            return new InternalServerError(`${context} (PayPal error ${e.statusCode})`);
        }
        if (e instanceof UserInputError || e instanceof InternalServerError || e instanceof EntityNotFoundError) {
            return e;
        }
        const message = e instanceof Error ? e.message : String(e);
        Logger.error(`${context}: ${message}`, loggerCtx);
        return new InternalServerError(context);
    }
}
