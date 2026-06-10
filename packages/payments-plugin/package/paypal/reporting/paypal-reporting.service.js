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
exports.PayPalReportingService = void 0;
const common_1 = require("@nestjs/common");
const paypal_server_sdk_1 = require("@paypal/paypal-server-sdk");
const core_1 = require("@vendure/core");
const constants_1 = require("../constants");
const paypal_utils_1 = require("../paypal-utils");
const paypal_service_1 = require("../paypal.service");
/**
 * PayPal limits a single transaction-search query to a 31-day date range. Longer
 * ranges are split into windows of this size and stitched together.
 */
const MAX_WINDOW_DAYS = 31;
const MAX_WINDOW_MS = MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const TRANSACTIONS_PAGE_SIZE = 100;
let PayPalReportingService = class PayPalReportingService {
    constructor(paypalService) {
        this.paypalService = paypalService;
    }
    /**
     * Searches PayPal transactions within the given date range. Ranges longer than
     * 31 days are automatically split into windows and stitched together; each
     * window is fully paginated.
     *
     * Note: PayPal transactions can take up to 3 hours to appear, so this is
     * intended for reconciliation/accounting, not real-time payment confirmation.
     */
    async searchTransactions(ctx, startDate, endDate, transactionStatus) {
        if (startDate.getTime() > endDate.getTime()) {
            throw new core_1.UserInputError('startDate must be before endDate');
        }
        const reports = [];
        for (const [windowStart, windowEnd] of this.splitIntoWindows(startDate, endDate)) {
            reports.push(...(await this.searchWindow(windowStart, windowEnd, transactionStatus)));
        }
        return reports;
    }
    async getBalances(ctx, asOfTime, currencyCode) {
        var _a;
        try {
            const { result } = await this.client().transactionSearch.searchBalances({
                asOfTime: asOfTime ? asOfTime.toISOString() : undefined,
                currencyCode,
            });
            return {
                accountId: result.accountId,
                asOfTime: result.asOfTime,
                lastRefreshTime: result.lastRefreshTime,
                balances: ((_a = result.balances) !== null && _a !== void 0 ? _a : []).map(balance => {
                    var _a;
                    return ({
                        currencyCode: balance.currency,
                        primary: (_a = balance.primary) !== null && _a !== void 0 ? _a : false,
                        totalBalance: this.toMinorUnits(balance.totalBalance),
                        availableBalance: this.toMinorUnitsOptional(balance.availableBalance),
                        withheldBalance: this.toMinorUnitsOptional(balance.withheldBalance),
                    });
                }),
            };
        }
        catch (e) {
            throw this.handleApiError(e, 'Failed to retrieve PayPal balances');
        }
    }
    async searchWindow(windowStart, windowEnd, transactionStatus) {
        var _a, _b;
        const reports = [];
        let page = 1;
        let totalPages = 1;
        try {
            do {
                const { result } = await this.client().transactionSearch.searchTransactions({
                    startDate: windowStart.toISOString(),
                    endDate: windowEnd.toISOString(),
                    transactionStatus,
                    fields: 'transaction_info',
                    pageSize: TRANSACTIONS_PAGE_SIZE,
                    page,
                });
                for (const detail of (_a = result.transactionDetails) !== null && _a !== void 0 ? _a : []) {
                    if (detail.transactionInfo) {
                        reports.push(this.mapTransaction(detail.transactionInfo));
                    }
                }
                totalPages = (_b = result.totalPages) !== null && _b !== void 0 ? _b : 1;
                page++;
            } while (page <= totalPages);
        }
        catch (e) {
            throw this.handleApiError(e, `Failed to search PayPal transactions between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`);
        }
        return reports;
    }
    mapTransaction(info) {
        var _a;
        return {
            transactionId: info.transactionId,
            status: info.transactionStatus,
            eventCode: info.transactionEventCode,
            amount: this.toMinorUnitsOptional(info.transactionAmount),
            feeAmount: this.toMinorUnitsOptional(info.feeAmount),
            currencyCode: (_a = info.transactionAmount) === null || _a === void 0 ? void 0 : _a.currencyCode,
            initiationDate: info.transactionInitiationDate,
            updatedDate: info.transactionUpdatedDate,
        };
    }
    /**
     * Splits a date range into consecutive windows no longer than 31 days each.
     */
    splitIntoWindows(startDate, endDate) {
        const windows = [];
        let cursor = startDate.getTime();
        const end = endDate.getTime();
        while (cursor < end) {
            const windowEnd = Math.min(cursor + MAX_WINDOW_MS, end);
            windows.push([new Date(cursor), new Date(windowEnd)]);
            cursor = windowEnd;
        }
        if (windows.length === 0) {
            // start === end: still issue a single (empty-range) query.
            windows.push([startDate, endDate]);
        }
        return windows;
    }
    toMinorUnits(money) {
        if (!(money === null || money === void 0 ? void 0 : money.value) || !money.currencyCode) {
            return 0;
        }
        return (0, paypal_utils_1.fromPayPalAmount)(money.value, money.currencyCode);
    }
    toMinorUnitsOptional(money) {
        if (!(money === null || money === void 0 ? void 0 : money.value) || !money.currencyCode) {
            return undefined;
        }
        return (0, paypal_utils_1.fromPayPalAmount)(money.value, money.currencyCode);
    }
    client() {
        return this.paypalService.getClient();
    }
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
exports.PayPalReportingService = PayPalReportingService;
exports.PayPalReportingService = PayPalReportingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [paypal_service_1.PayPalService])
], PayPalReportingService);
//# sourceMappingURL=paypal-reporting.service.js.map