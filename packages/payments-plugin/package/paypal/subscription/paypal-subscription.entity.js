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
exports.PayPalSubscription = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * @description
 * Represents a customer's PayPal subscription created via this plugin. It tracks
 * the PayPal subscription id and a synced copy of its status, so the merchant can
 * view and manage subscriptions from the Vendure admin.
 */
let PayPalSubscription = class PayPalSubscription extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PayPalSubscription = PayPalSubscription;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], PayPalSubscription.prototype, "paypalSubscriptionId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalSubscription.prototype, "paypalPlanId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalSubscription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)('text', { nullable: true }),
    __metadata("design:type", Object)
], PayPalSubscription.prototype, "approveUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayPalSubscription.prototype, "customerEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayPalSubscription.prototype, "customerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], PayPalSubscription.prototype, "failedPaymentsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: Date, nullable: true }),
    __metadata("design:type", Object)
], PayPalSubscription.prototype, "lastSyncedAt", void 0);
exports.PayPalSubscription = PayPalSubscription = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PayPalSubscription);
//# sourceMappingURL=paypal-subscription.entity.js.map