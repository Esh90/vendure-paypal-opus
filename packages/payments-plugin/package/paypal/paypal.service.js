"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalService = void 0;
const common_1 = require("@nestjs/common");
const paypal_server_sdk_1 = require("@paypal/paypal-server-sdk");
const core_1 = require("@vendure/core");
const constants_1 = require("./constants");
const paypal_client_1 = require("./paypal-client");
const paypal_handler_1 = require("./paypal.handler");
const paypal_utils_1 = require("./paypal-utils");
let PayPalService = class PayPalService {
    constructor(options, paymentMethodService) {
        this.options = options;
        this.paymentMethodService = paymentMethodService;
        this.warnedAboutDefaultUrls = false;
    }
    /**
     * Creates a PayPal order for the given Vendure order. The order's intent
     * (`CAPTURE` or `AUTHORIZE`) is taken from the configured PayPal payment
     * method. The returned order is in the `CREATED` state and must be approved
     * by the buyer before it can be captured or authorized.
     */
    async createOrder(ctx, order) {
        var _a, _b, _c, _d;
        const method = await this.getPaymentMethod(ctx);
        await this.assertPaymentMethodEligible(ctx, order, method);
        const intent = this.getConfiguredIntent(method);
        const currencyCode = order.currencyCode;
        const value = (0, paypal_utils_1.toPayPalAmount)(order.totalWithTax, currencyCode);
        const { returnUrl, cancelUrl } = this.resolveRedirectUrls();
        try {
            const { result } = await this.getClient().orders.createOrder({
                body: {
                    intent,
                    purchaseUnits: [
                        {
                            referenceId: 'default',
                            customId: order.code,
                            description: `Order ${order.code}`,
                            amount: {
                                currencyCode,
                                value,
                            },
                        },
                    ],
                    applicationContext: {
                        brandName: this.options.brandName,
                        userAction: paypal_server_sdk_1.OrderApplicationContextUserAction.PayNow,
                        shippingPreference: paypal_server_sdk_1.OrderApplicationContextShippingPreference.NoShipping,
                        // PayPal requires a redirect target for the hosted approval flow;
                        // without it the buyer-approval page never completes.
                        returnUrl,
                        cancelUrl,
                    },
                },
                prefer: 'return=representation',
                // Idempotency key: the same cart total + intent yields the same PayPal
                // order, preventing duplicate orders if the storefront retries the call.
                paypalRequestId: `create-${order.code}-${intent}-${currencyCode}-${value}`,
            });
            if (!result.id) {
                throw new core_1.InternalServerError('PayPal did not return an order id');
            }
            const approveUrl = (_b = (_a = result.links) === null || _a === void 0 ? void 0 : _a.find(link => link.rel === 'approve' || link.rel === 'payer-action')) === null || _b === void 0 ? void 0 : _b.href;
            core_1.Logger.verbose(`Created PayPal order ${result.id} (${(_c = result.status) !== null && _c !== void 0 ? _c : 'unknown'}) for order ${order.code}`, constants_1.loggerCtx);
            return {
                id: result.id,
                status: (_d = result.status) !== null && _d !== void 0 ? _d : 'CREATED',
                approveUrl,
            };
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to create PayPal order for order ${order.code}`);
        }
    }
    /**
     * Retrieves the intent (`CAPTURE` or `AUTHORIZE`) that a PayPal order was
     * created with. This is the authoritative source of truth for how an
     * approved order must be processed, ensuring the capture/authorize action
     * always matches the order and avoiding `ACTION_DOES_NOT_MATCH_INTENT`
     * (HTTP 422) errors.
     */
    async getOrderIntent(ctx, paypalOrderId) {
        try {
            const { result } = await this.getClient().orders.getOrder({ id: paypalOrderId });
            return result.intent === paypal_server_sdk_1.CheckoutPaymentIntent.Authorize
                ? paypal_server_sdk_1.CheckoutPaymentIntent.Authorize
                : paypal_server_sdk_1.CheckoutPaymentIntent.Capture;
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to retrieve PayPal order ${paypalOrderId}`);
        }
    }
    /**
     * Captures a previously-approved PayPal order, moving the funds from the
     * buyer to the merchant.
     */
    async captureOrder(ctx, paypalOrderId) {
        try {
            const { result } = await this.getClient().orders.captureOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });
            return this.extractCaptureResult(result, paypalOrderId);
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to capture PayPal order ${paypalOrderId}`);
        }
    }
    extractCaptureResult(result, paypalOrderId) {
        var _a, _b, _c, _d, _e;
        const capture = (_d = (_c = (_b = (_a = result.purchaseUnits) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.payments) === null || _c === void 0 ? void 0 : _c.captures) === null || _d === void 0 ? void 0 : _d[0];
        if (!(capture === null || capture === void 0 ? void 0 : capture.id) || !capture.status) {
            throw new core_1.InternalServerError(`PayPal capture for order ${paypalOrderId} did not return a capture result`);
        }
        const captureAmount = capture.amount;
        if (!(captureAmount === null || captureAmount === void 0 ? void 0 : captureAmount.value) || !captureAmount.currencyCode) {
            throw new core_1.InternalServerError(`PayPal capture ${capture.id} did not return an amount`);
        }
        return {
            orderStatus: (_e = result.status) !== null && _e !== void 0 ? _e : 'unknown',
            captureId: capture.id,
            captureStatus: capture.status,
            amount: (0, paypal_utils_1.fromPayPalAmount)(captureAmount.value, captureAmount.currencyCode),
            currencyCode: captureAmount.currencyCode,
        };
    }
    /**
     * Authorizes a previously-approved PayPal order, reserving the funds without
     * capturing them. The returned authorization can later be captured (on
     * fulfilment) via {@link captureAuthorization} or voided via
     * {@link voidAuthorization}.
     */
    async authorizeOrder(ctx, paypalOrderId) {
        try {
            const { result } = await this.getClient().orders.authorizeOrder({
                id: paypalOrderId,
                prefer: 'return=representation',
            });
            return this.extractAuthorizeResult(result, paypalOrderId);
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to authorize PayPal order ${paypalOrderId}`);
        }
    }
    extractAuthorizeResult(result, paypalOrderId) {
        var _a, _b, _c, _d, _e;
        const authorization = (_d = (_c = (_b = (_a = result.purchaseUnits) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.payments) === null || _c === void 0 ? void 0 : _c.authorizations) === null || _d === void 0 ? void 0 : _d[0];
        if (!(authorization === null || authorization === void 0 ? void 0 : authorization.id) || !authorization.status) {
            throw new core_1.InternalServerError(`PayPal authorization for order ${paypalOrderId} did not return an authorization result`);
        }
        return {
            orderStatus: (_e = result.status) !== null && _e !== void 0 ? _e : 'unknown',
            authorizationId: authorization.id,
            authorizationStatus: authorization.status,
        };
    }
    /**
     * Captures the full amount of a previously-authorized PayPal payment. This is
     * a final capture, meaning no further captures can be made against the
     * authorization.
     */
    async captureAuthorization(ctx, authorizationId) {
        try {
            const { result } = await this.getClient().payments.captureAuthorizedPayment({
                authorizationId,
                prefer: 'return=representation',
                // Omitting `amount` captures the full authorized amount.
                body: {
                    finalCapture: true,
                },
            });
            if (!result.id || !result.status) {
                throw new core_1.InternalServerError(`PayPal capture of authorization ${authorizationId} did not return a capture result`);
            }
            return {
                captureId: result.id,
                captureStatus: result.status,
            };
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to capture PayPal authorization ${authorizationId}`);
        }
    }
    /**
     * Returns the enabled `PaymentMethod` whose handler is the PayPal handler, or
     * throws if none exists.
     */
    async getPaymentMethod(ctx) {
        const method = (await this.paymentMethodService.findAll(ctx, { filter: { enabled: { eq: true } } })).items.find(pm => pm.handler.code === paypal_handler_1.paypalPaymentMethodHandler.code);
        if (!method) {
            throw new core_1.UserInputError('No enabled PayPal payment method found');
        }
        return method;
    }
    /**
     * Ensures that the given PayPal payment method is eligible for the order
     * before a PayPal order is created.
     */
    async assertPaymentMethodEligible(ctx, order, paypalMethod) {
        const eligibleMethods = await this.paymentMethodService.getEligiblePaymentMethods(ctx, order);
        const isEligible = eligibleMethods.some(pm => pm.code === paypalMethod.code);
        if (!isEligible) {
            throw new core_1.UserInputError(`PayPal payment method is not eligible for order ${order.code}`);
        }
    }
    /**
     * Reads the configured checkout intent (`capture` or `authorize`) from the
     * PayPal payment method's handler arguments, defaulting to `capture`.
     */
    getConfiguredIntent(method) {
        var _a;
        const value = (_a = method.handler.args.find(arg => arg.name === 'intent')) === null || _a === void 0 ? void 0 : _a.value;
        const intent = value === 'authorize' ? 'authorize' : 'capture';
        return intent === 'authorize' ? paypal_server_sdk_1.CheckoutPaymentIntent.Authorize : paypal_server_sdk_1.CheckoutPaymentIntent.Capture;
    }
    /**
     * Resolves the buyer-approval redirect URLs, falling back to localhost
     * defaults (intended for sandbox/local development) when they are not
     * configured. A warning is logged once if the defaults are used, since real
     * storefront URLs should be configured for production.
     */
    resolveRedirectUrls() {
        var _a, _b;
        const returnUrl = (_a = this.options.returnUrl) !== null && _a !== void 0 ? _a : constants_1.DEFAULT_RETURN_URL;
        const cancelUrl = (_b = this.options.cancelUrl) !== null && _b !== void 0 ? _b : constants_1.DEFAULT_CANCEL_URL;
        if ((!this.options.returnUrl || !this.options.cancelUrl) && !this.warnedAboutDefaultUrls) {
            this.warnedAboutDefaultUrls = true;
            core_1.Logger.warn('PayPalPlugin returnUrl/cancelUrl not configured; falling back to localhost defaults. ' +
                'Configure them via PayPalPlugin.init() for production.', constants_1.loggerCtx);
        }
        return { returnUrl, cancelUrl };
    }
    getClient() {
        if (!this.client) {
            this.client = new paypal_client_1.PayPalClient(this.options);
        }
        return this.client;
    }
    /**
     * Normalises errors thrown by the PayPal SDK into a logged Vendure error. The
     * original PayPal error body is logged for troubleshooting, while a concise
     * message is surfaced to the caller.
     */
    handleApiError(e, context) {
        var _a;
        if (e instanceof paypal_server_sdk_1.ApiError) {
            const detail = typeof e.body === 'string' ? e.body : JSON.stringify((_a = e.result) !== null && _a !== void 0 ? _a : e.message);
            core_1.Logger.error(`${context}: [${e.statusCode}] ${detail}`, constants_1.loggerCtx);
            return new core_1.InternalServerError(`${context} (PayPal error ${e.statusCode})`);
        }
        if (e instanceof core_1.UserInputError || e instanceof core_1.InternalServerError) {
            return e;
        }
        const message = e instanceof Error ? e.message : String(e);
        core_1.Logger.error(`${context}: ${message}`, constants_1.loggerCtx);
        return new core_1.InternalServerError(context);
    }
};
exports.PayPalService = PayPalService;
exports.PayPalService = PayPalService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(constants_1.PAYPAL_PLUGIN_OPTIONS)),
    __metadata("design:paramtypes", [Object, core_1.PaymentMethodService])
], PayPalService);
//# sourceMappingURL=paypal.service.js.map