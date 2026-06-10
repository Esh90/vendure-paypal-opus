import { ID } from '@vendure/core';

/**
 * The billing interval unit accepted when creating a billing plan. Mirrors
 * PayPal's `IntervalUnit` enum.
 */
export type PayPalBillingInterval = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

/**
 * Input for creating a PayPal billing plan via the Admin API.
 */
export interface CreatePayPalBillingPlanInput {
    /** The PayPal Catalog Product id (`PROD-...`) the plan belongs to. */
    productId: string;
    name: string;
    description?: string;
    intervalUnit: PayPalBillingInterval;
    intervalCount: number;
    /** Number of billing cycles; `0` (default) means it recurs indefinitely. */
    totalCycles?: number;
    /** The recurring price as an integer in the currency's minor units. */
    priceAmount: number;
    currencyCode: string;
    /** Consecutive failed payments before PayPal suspends a subscription. */
    paymentFailureThreshold?: number;
}

/**
 * Input for updating an existing PayPal billing plan via the Admin API.
 */
export interface UpdatePayPalBillingPlanInput {
    /** New recurring price as an integer in the currency's minor units. */
    priceAmount?: number;
    /** New consecutive-failure threshold before suspension. */
    paymentFailureThreshold?: number;
}

/**
 * The result returned to the storefront when a subscription is created. The
 * buyer must visit `approveUrl` to approve recurring charges.
 */
export interface PayPalSubscriptionResult {
    id: ID;
    paypalSubscriptionId: string;
    status: string;
    approveUrl?: string;
}
