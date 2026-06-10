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
exports.PayPalReportingAdminResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const core_1 = require("@vendure/core");
const paypal_reporting_service_1 = require("./paypal-reporting.service");
let PayPalReportingAdminResolver = class PayPalReportingAdminResolver {
    constructor(reportingService) {
        this.reportingService = reportingService;
    }
    payPalTransactions(ctx, args) {
        return this.reportingService.searchTransactions(ctx, this.parseDate(args.startDate, 'startDate'), this.parseDate(args.endDate, 'endDate'), args.transactionStatus);
    }
    payPalBalances(ctx, args) {
        return this.reportingService.getBalances(ctx, args.asOfTime != null ? this.parseDate(args.asOfTime, 'asOfTime') : undefined, args.currencyCode);
    }
    parseDate(value, field) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new core_1.UserInputError(`Invalid date provided for "${field}"`);
        }
        return date;
    }
};
exports.PayPalReportingAdminResolver = PayPalReportingAdminResolver;
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalReportingAdminResolver.prototype, "payPalTransactions", null);
__decorate([
    (0, graphql_1.Query)(),
    (0, core_1.Allow)(core_1.Permission.ReadOrder),
    __param(0, (0, core_1.Ctx)()),
    __param(1, (0, graphql_1.Args)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [core_1.RequestContext, Object]),
    __metadata("design:returntype", Promise)
], PayPalReportingAdminResolver.prototype, "payPalBalances", null);
exports.PayPalReportingAdminResolver = PayPalReportingAdminResolver = __decorate([
    (0, graphql_1.Resolver)(),
    __metadata("design:paramtypes", [paypal_reporting_service_1.PayPalReportingService])
], PayPalReportingAdminResolver);
//# sourceMappingURL=paypal-reporting.admin-resolver.js.map