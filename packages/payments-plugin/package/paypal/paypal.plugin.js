"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var PayPalPlugin_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalPlugin = void 0;
const core_1 = require("@vendure/core");
const graphql_tag_1 = require("graphql-tag");
const constants_1 = require("./constants");
const paypal_handler_1 = require("./paypal.handler");
const paypal_resolver_1 = require("./paypal.resolver");
const paypal_service_1 = require("./paypal.service");
const paypal_billing_plan_entity_1 = require("./subscription/paypal-billing-plan.entity");
const paypal_subscription_entity_1 = require("./subscription/paypal-subscription.entity");
const paypal_subscription_admin_resolver_1 = require("./subscription/paypal-subscription.admin-resolver");
const paypal_subscription_service_1 = require("./subscription/paypal-subscription.service");
const paypal_subscription_shop_resolver_1 = require("./subscription/paypal-subscription.shop-resolver");
const paypal_subscription_sync_task_1 = require("./subscription/paypal-subscription-sync-task");
const subscription_api_extensions_1 = require("./subscription/subscription-api-extensions");
const paypal_reporting_admin_resolver_1 = require("./reporting/paypal-reporting.admin-resolver");
const paypal_reporting_service_1 = require("./reporting/paypal-reporting.service");
const reporting_api_extensions_1 = require("./reporting/reporting-api-extensions");
/**
 * @description
 * Plugin to enable payments through [PayPal](https://developer.paypal.com/) using
 * the PayPal Server SDK.
 *
 * ## Requirements
 *
 * 1. Create a PayPal REST API app in the [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications)
 *    to obtain a client id and secret.
 * 2. Install the Payments plugin and the PayPal Server SDK:
 *
 *     `npm install \@vendure/payments-plugin \@paypal/paypal-server-sdk`
 *
 * ## Setup
 *
 * 1. Add the plugin to your VendureConfig `plugins` array:
 *     ```ts
 *     import { PayPalPlugin } from '\@vendure/payments-plugin/package/paypal';
 *
 *     plugins: [
 *       PayPalPlugin.init({
 *         clientId: process.env.PAYPAL_CLIENT_ID,
 *         clientSecret: process.env.PAYPAL_CLIENT_SECRET,
 *         environment: 'sandbox',
 *       }),
 *     ],
 *     ```
 * 2. Create a new PaymentMethod in the Admin UI, and select "PayPal payments" as the handler.
 *
 * ## Storefront usage (standard checkout, immediate capture)
 *
 * 1. With the order in the `ArrangingPayment` state, call the `createPayPalOrder` mutation
 *    exposed by this plugin. It returns the PayPal order `id`, its `status` and (for the
 *    redirect flow) an `approveUrl`.
 * 2. Direct the buyer to approve the payment, either by redirecting to `approveUrl` or by
 *    using the PayPal JS SDK (Smart Payment Buttons) with the returned order `id`.
 * 3. After the buyer approves, complete the payment with the standard `addPaymentToOrder`
 *    mutation, passing the approved PayPal order id:
 *     ```graphql
 *     mutation {
 *       addPaymentToOrder(input: {
 *         method: "paypal",
 *         metadata: { paypalOrderId: "<the PayPal order id>" }
 *       }) {
 *         ... on Order { id state }
 *         ... on ErrorResult { errorCode message }
 *       }
 *     }
 *     ```
 *
 * @docsCategory core plugins/PaymentsPlugin
 * @docsPage PayPalPlugin
 */
let PayPalPlugin = PayPalPlugin_1 = class PayPalPlugin {
    /**
     * @description
     * Initialise the PayPal payment plugin. Credentials default to the
     * `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_ENVIRONMENT`
     * environment variables when not provided explicitly.
     */
    static init(options = {}) {
        var _a, _b, _c;
        const clientId = (_a = options.clientId) !== null && _a !== void 0 ? _a : process.env.PAYPAL_CLIENT_ID;
        const clientSecret = (_b = options.clientSecret) !== null && _b !== void 0 ? _b : process.env.PAYPAL_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            throw new Error('PayPalPlugin requires a clientId and clientSecret (set them directly or via the ' +
                'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET environment variables)');
        }
        const environment = (_c = options.environment) !== null && _c !== void 0 ? _c : (process.env.PAYPAL_ENVIRONMENT === 'production' ? 'production' : 'sandbox');
        this.options = Object.assign(Object.assign({}, options), { clientId,
            clientSecret,
            environment });
        return PayPalPlugin_1;
    }
};
exports.PayPalPlugin = PayPalPlugin;
exports.PayPalPlugin = PayPalPlugin = PayPalPlugin_1 = __decorate([
    (0, core_1.VendurePlugin)({
        imports: [core_1.PluginCommonModule],
        entities: [paypal_billing_plan_entity_1.PayPalBillingPlan, paypal_subscription_entity_1.PayPalSubscription],
        providers: [
            {
                provide: constants_1.PAYPAL_PLUGIN_OPTIONS,
                useFactory: () => PayPalPlugin.options,
            },
            paypal_service_1.PayPalService,
            paypal_subscription_service_1.PayPalSubscriptionService,
            paypal_reporting_service_1.PayPalReportingService,
        ],
        configuration: config => {
            config.paymentOptions.paymentMethodHandlers.push(paypal_handler_1.paypalPaymentMethodHandler);
            config.schedulerOptions.tasks.push(paypal_subscription_sync_task_1.payPalSubscriptionSyncTask);
            return config;
        },
        adminApiExtensions: {
            schema: (0, graphql_tag_1.gql) `
            ${subscription_api_extensions_1.adminApiExtensions}
            ${reporting_api_extensions_1.adminApiExtensions}
        `,
            resolvers: [paypal_subscription_admin_resolver_1.PayPalSubscriptionAdminResolver, paypal_reporting_admin_resolver_1.PayPalReportingAdminResolver],
        },
        shopApiExtensions: {
            schema: (0, graphql_tag_1.gql) `
            ${subscription_api_extensions_1.shopApiExtensions}
            type PayPalOrderResult {
                id: String!
                status: String!
                approveUrl: String
            }
            extend type Mutation {
                createPayPalOrder: PayPalOrderResult!
            }
        `,
            resolvers: [paypal_resolver_1.PayPalShopResolver, paypal_subscription_shop_resolver_1.PayPalSubscriptionShopResolver],
        },
        exports: [paypal_service_1.PayPalService, paypal_subscription_service_1.PayPalSubscriptionService],
        compatibility: '^3.0.0',
    })
], PayPalPlugin);
//# sourceMappingURL=paypal.plugin.js.map