"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.payPalSubscriptionSyncTask = void 0;
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const paypal_subscription_service_1 = require("./paypal-subscription.service");
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
exports.payPalSubscriptionSyncTask = new core_1.ScheduledTask({
    id: 'paypal-subscription-sync',
    description: 'Sync PayPal subscription statuses and detect failed payments',
    schedule: cron => cron.everyHour(),
    async execute({ injector }) {
        const requestContextService = injector.get(core_1.RequestContextService);
        const subscriptionService = injector.get(paypal_subscription_service_1.PayPalSubscriptionService);
        const ctx = await requestContextService.create({ apiType: 'admin' });
        const synced = await subscriptionService.syncActiveSubscriptions(ctx);
        core_1.Logger.verbose(`Synced ${synced} PayPal subscription(s)`, constants_1.loggerCtx);
        return { synced };
    },
});
//# sourceMappingURL=paypal-subscription-sync-task.js.map