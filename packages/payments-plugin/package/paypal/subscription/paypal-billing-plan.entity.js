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
exports.PayPalBillingPlan = void 0;
const core_1 = require("@vendure/core");
const typeorm_1 = require("typeorm");
/**
 * @description
 * Represents a PayPal subscription billing plan that has been created via this
 * plugin. It mirrors the key attributes of the corresponding PayPal billing plan
 * and stores the PayPal-generated identifiers needed for subsequent operations.
 */
let PayPalBillingPlan = class PayPalBillingPlan extends core_1.VendureEntity {
    constructor(input) {
        super(input);
    }
};
exports.PayPalBillingPlan = PayPalBillingPlan;
__decorate([
    (0, typeorm_1.Column)({ unique: true }),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "paypalPlanId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "paypalProductId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "intervalUnit", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PayPalBillingPlan.prototype, "intervalCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], PayPalBillingPlan.prototype, "totalCycles", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", Number)
], PayPalBillingPlan.prototype, "priceAmount", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "currencyCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 0 }),
    __metadata("design:type", Number)
], PayPalBillingPlan.prototype, "paymentFailureThreshold", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], PayPalBillingPlan.prototype, "status", void 0);
exports.PayPalBillingPlan = PayPalBillingPlan = __decorate([
    (0, typeorm_1.Entity)(),
    __metadata("design:paramtypes", [Object])
], PayPalBillingPlan);
//# sourceMappingURL=paypal-billing-plan.entity.js.map