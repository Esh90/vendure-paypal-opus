import { Logger, RequestContextService, ScheduledTask } from '@vendure/core';

import { loggerCtx } from '../constants';

import { PayPalSubscriptionService } from './paypal-subscription.service';

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
export const payPalSubscriptionSyncTask = new ScheduledTask({
    id: 'paypal-subscription-sync',
    description: 'Sync PayPal subscription statuses and detect failed payments',
    schedule: cron => cron.everyHour(),
    async execute({ injector }) {
        const requestContextService = injector.get(RequestContextService);
        const subscriptionService = injector.get(PayPalSubscriptionService);
        const ctx = await requestContextService.create({ apiType: 'admin' });
        const synced = await subscriptionService.syncActiveSubscriptions(ctx);
        Logger.verbose(`Synced ${synced} PayPal subscription(s)`, loggerCtx);
        return { synced };
    },
});
