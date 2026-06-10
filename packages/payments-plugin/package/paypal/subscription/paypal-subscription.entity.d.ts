import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * @description
 * Represents a customer's PayPal subscription created via this plugin. It tracks
 * the PayPal subscription id and a synced copy of its status, so the merchant can
 * view and manage subscriptions from the Vendure admin.
 */
export declare class PayPalSubscription extends VendureEntity {
    constructor(input?: DeepPartial<PayPalSubscription>);
    /** The PayPal-generated subscription id (e.g. `I-XXXXXXXX`). */
    paypalSubscriptionId: string;
    /** The PayPal billing plan id this subscription is based on. */
    paypalPlanId: string;
    /**
     * The PayPal subscription status, synced from PayPal:
     * `APPROVAL_PENDING`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `CANCELLED` or `EXPIRED`.
     */
    status: string;
    /** The HATEOAS approval URL the buyer must visit to approve the subscription. */
    approveUrl: string | null;
    /** The email address of the Vendure customer who created the subscription. */
    customerEmail: string;
    /** The id of the Vendure customer who created the subscription, when known. */
    customerId: string;
    /** The number of consecutive failed payments, synced from PayPal. */
    failedPaymentsCount: number;
    /** The time the subscription status was last synced from PayPal. */
    lastSyncedAt: Date | null;
}
