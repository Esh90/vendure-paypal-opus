import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * @description
 * Represents a customer's PayPal subscription created via this plugin. It tracks
 * the PayPal subscription id and a synced copy of its status, so the merchant can
 * view and manage subscriptions from the Vendure admin.
 */
@Entity()
export class PayPalSubscription extends VendureEntity {
    constructor(input?: DeepPartial<PayPalSubscription>) {
        super(input);
    }

    /** The PayPal-generated subscription id (e.g. `I-XXXXXXXX`). */
    @Column({ unique: true })
    paypalSubscriptionId: string;

    /** The PayPal billing plan id this subscription is based on. */
    @Column()
    paypalPlanId: string;

    /**
     * The PayPal subscription status, synced from PayPal:
     * `APPROVAL_PENDING`, `APPROVED`, `ACTIVE`, `SUSPENDED`, `CANCELLED` or `EXPIRED`.
     */
    @Column()
    status: string;

    /** The HATEOAS approval URL the buyer must visit to approve the subscription. */
    @Column('text', { nullable: true })
    approveUrl: string | null;

    /** The email address of the Vendure customer who created the subscription. */
    @Column({ nullable: true })
    customerEmail: string;

    /** The id of the Vendure customer who created the subscription, when known. */
    @Column({ nullable: true })
    customerId: string;

    /** The number of consecutive failed payments, synced from PayPal. */
    @Column({ default: 0 })
    failedPaymentsCount: number;

    /** The time the subscription status was last synced from PayPal. */
    @Column({ type: Date, nullable: true })
    lastSyncedAt: Date | null;
}
