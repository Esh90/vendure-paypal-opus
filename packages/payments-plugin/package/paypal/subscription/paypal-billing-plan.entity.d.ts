import { DeepPartial, VendureEntity } from '@vendure/core';
/**
 * @description
 * Represents a PayPal subscription billing plan that has been created via this
 * plugin. It mirrors the key attributes of the corresponding PayPal billing plan
 * and stores the PayPal-generated identifiers needed for subsequent operations.
 */
export declare class PayPalBillingPlan extends VendureEntity {
    constructor(input?: DeepPartial<PayPalBillingPlan>);
    /** The PayPal-generated billing plan id (e.g. `P-XXXXXXXX`). */
    paypalPlanId: string;
    /** The PayPal Catalog Product id (e.g. `PROD-XXXX`) the plan belongs to. */
    paypalProductId: string;
    name: string;
    description: string;
    /** The billing interval unit: `DAY`, `WEEK`, `MONTH` or `YEAR`. */
    intervalUnit: string;
    /** The number of interval units between charges (e.g. `1` month). */
    intervalCount: number;
    /** The number of billing cycles; `0` means the plan recurs indefinitely. */
    totalCycles: number;
    /** The recurring price, stored as an integer in the currency's minor units. */
    priceAmount: number;
    currencyCode: string;
    /** The number of consecutive failed payments before PayPal suspends a subscription. */
    paymentFailureThreshold: number;
    /** The PayPal plan status: `CREATED`, `ACTIVE` or `INACTIVE`. */
    status: string;
}
