import { ScheduledTask } from '@vendure/core';
/**
 * @description
 * A {@link ScheduledTask} that periodically syncs the status of all non-terminal
 * PayPal subscriptions into the local entities. This keeps the merchant's view of
 * subscription status up to date and surfaces subscriptions with failed payments
 * (so they can be retried), since PayPal performs the recurring charging itself.
 *
 * The default schedule is hourly; configure it via
 * `payPalSubscriptionSyncTask.configure({ schedule: cron => ... })`.
 */
export declare const payPalSubscriptionSyncTask: ScheduledTask<Record<string, any>>;
