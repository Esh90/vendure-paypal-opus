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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayPalFulfillmentService = void 0;
const common_1 = require("@nestjs/common");
const paypal_server_sdk_1 = require("@paypal/paypal-server-sdk");
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
const constants_1 = require("../constants");
const paypal_service_1 = require("../paypal.service");
/**
 * The fulfillment state that triggers pushing tracking to PayPal.
 */
const TRACK_ON_STATE = 'Shipped';
/**
 * @description
 * Subscribes to {@link FulfillmentStateTransitionEvent} and, when a fulfillment is
 * marked as shipped, pushes the carrier and tracking number to PayPal so the
 * buyer can see shipment tracking in their PayPal account.
 *
 * This has no custom endpoints or entities — it reacts to Vendure's fulfillment
 * lifecycle. Failures are logged but never interrupt the merchant's fulfillment
 * flow (the event is handled after the transition has committed).
 */
let PayPalFulfillmentService = class PayPalFulfillmentService {
    constructor(eventBus, connection, fulfillmentService, paypalService) {
        this.eventBus = eventBus;
        this.connection = connection;
        this.fulfillmentService = fulfillmentService;
        this.paypalService = paypalService;
    }
    onApplicationBootstrap() {
        this.eventBus.ofType(core_1.FulfillmentStateTransitionEvent).subscribe(event => {
            if (event.toState === TRACK_ON_STATE) {
                // Fire-and-forget: tracking is best-effort and must not block fulfillment.
                void this.pushTracking(event.ctx, event.fulfillment).catch(e => {
                    core_1.Logger.error(`Failed to push PayPal tracking for fulfillment ${event.fulfillment.id}: ${e instanceof Error ? e.message : String(e)}`, constants_1.loggerCtx);
                });
            }
        });
    }
    /**
     * Pushes the fulfillment's tracking details to PayPal for every order in the
     * fulfillment that was paid via PayPal.
     */
    async pushTracking(ctx, fulfillment) {
        var _a, _b, _c;
        const trackingNumber = (_a = fulfillment.trackingCode) === null || _a === void 0 ? void 0 : _a.trim();
        if (!trackingNumber) {
            core_1.Logger.verbose(`Fulfillment ${fulfillment.id} has no tracking code; skipping PayPal tracking`, constants_1.loggerCtx);
            return;
        }
        const orders = await this.getOrdersForFulfillment(ctx, fulfillment.id);
        for (const order of orders) {
            const payment = this.findPayPalPayment(order);
            if (!payment) {
                continue;
            }
            const paypalOrderId = (_b = payment.metadata) === null || _b === void 0 ? void 0 : _b.paypalOrderId;
            const captureId = (_c = payment.metadata) === null || _c === void 0 ? void 0 : _c.captureId;
            if (!paypalOrderId || !captureId) {
                core_1.Logger.warn(`PayPal payment ${payment.id} on order ${order.code} is missing paypalOrderId/captureId; cannot push tracking`, constants_1.loggerCtx);
                continue;
            }
            await this.createTracking(paypalOrderId, captureId, trackingNumber, fulfillment.method);
            core_1.Logger.verbose(`Pushed PayPal tracking ${trackingNumber} for order ${order.code} (capture ${captureId})`, constants_1.loggerCtx);
        }
    }
    async createTracking(paypalOrderId, captureId, trackingNumber, method) {
        try {
            await this.paypalService.getClient().orders.createOrderTracking({
                id: paypalOrderId,
                body: {
                    captureId,
                    trackingNumber: trackingNumber.slice(0, 64),
                    // Vendure has no structured carrier, so the fulfillment method name
                    // is reported via the OTHER carrier.
                    carrier: paypal_server_sdk_1.ShipmentCarrier.Other,
                    carrierNameOther: (method && method.length ? method : 'Other').slice(0, 64),
                    notifyPayer: true,
                },
            });
        }
        catch (e) {
            throw this.normalizeApiError(e, paypalOrderId, captureId);
        }
    }
    async getOrdersForFulfillment(ctx, fulfillmentId) {
        const fulfillmentLines = await this.fulfillmentService.getFulfillmentLines(ctx, fulfillmentId);
        const orderLineIds = [...new Set(fulfillmentLines.map(line => line.orderLineId))];
        if (orderLineIds.length === 0) {
            return [];
        }
        const orderLines = await this.connection.getRepository(ctx, core_1.OrderLine).find({
            where: { id: (0, typeorm_1.In)(orderLineIds) },
            relations: ['order'],
        });
        const orderIds = [...new Set(orderLines.map(line => line.order.id))];
        if (orderIds.length === 0) {
            return [];
        }
        return this.connection.getRepository(ctx, core_1.Order).find({
            where: { id: (0, typeorm_1.In)(orderIds) },
            relations: ['payments'],
        });
    }
    findPayPalPayment(order) {
        var _a;
        return ((_a = order.payments) !== null && _a !== void 0 ? _a : []).find(payment => {
            var _a, _b;
            return payment.state === 'Settled' &&
                ((_a = payment.metadata) === null || _a === void 0 ? void 0 : _a.paypalOrderId) != null &&
                ((_b = payment.metadata) === null || _b === void 0 ? void 0 : _b.captureId) != null;
        });
    }
    normalizeApiError(e, paypalOrderId, captureId) {
        var _a;
        const context = `Failed to create PayPal tracking for order ${paypalOrderId} (capture ${captureId})`;
        if (e instanceof paypal_server_sdk_1.ApiError) {
            const detail = typeof e.body === 'string' ? e.body : JSON.stringify((_a = e.result) !== null && _a !== void 0 ? _a : e.message);
            core_1.Logger.error(`${context}: [${e.statusCode}] ${detail}`, constants_1.loggerCtx);
            return new Error(`${context} (PayPal error ${e.statusCode})`);
        }
        return e instanceof Error ? e : new Error(`${context}: ${String(e)}`);
    }
};
exports.PayPalFulfillmentService = PayPalFulfillmentService;
exports.PayPalFulfillmentService = PayPalFulfillmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.EventBus,
        core_1.TransactionalConnection,
        core_1.FulfillmentService,
        paypal_service_1.PayPalService])
], PayPalFulfillmentService);
//# sourceMappingURL=paypal-fulfillment.service.js.map