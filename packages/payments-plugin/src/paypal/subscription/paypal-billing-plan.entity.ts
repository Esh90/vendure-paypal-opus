import { DeepPartial, VendureEntity } from '@vendure/core';
import { Column, Entity } from 'typeorm';

/**
 * @description
 * Represents a PayPal subscription billing plan that has been created via this
 * plugin. It mirrors the key attributes of the corresponding PayPal billing plan
 * and stores the PayPal-generated identifiers needed for subsequent operations.
 */
@Entity()
export class PayPalBillingPlan extends VendureEntity {
    constructor(input?: DeepPartial<PayPalBillingPlan>) {
        super(input);
    }

    /** The PayPal-generated billing plan id (e.g. `P-XXXXXXXX`). */
    @Column({ unique: true })
    paypalPlanId: string;

    /** The PayPal Catalog Product id (e.g. `PROD-XXXX`) the plan belongs to. */
    @Column()
    paypalProductId: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    /** The billing interval unit: `DAY`, `WEEK`, `MONTH` or `YEAR`. */
    @Column()
    intervalUnit: string;

    /** The number of interval units between charges (e.g. `1` month). */
    @Column()
    intervalCount: number;

    /** The number of billing cycles; `0` means the plan recurs indefinitely. */
    @Column({ default: 0 })
    totalCycles: number;

    /** The recurring price, stored as an integer in the currency's minor units. */
    @Column()
    priceAmount: number;

    @Column()
    currencyCode: string;

    /** The number of consecutive failed payments before PayPal suspends a subscription. */
    @Column({ default: 0 })
    paymentFailureThreshold: number;

    /** The PayPal plan status: `CREATED`, `ACTIVE` or `INACTIVE`. */
    @Column()
    status: string;
}
