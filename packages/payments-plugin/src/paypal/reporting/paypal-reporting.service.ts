import { Injectable } from '@nestjs/common';
import { ApiError, Money, TransactionInformation } from '@paypal/paypal-server-sdk';
import { InternalServerError, Logger, RequestContext, UserInputError } from '@vendure/core';

import { loggerCtx } from '../constants';
import { PayPalClient } from '../paypal-client';
import { fromPayPalAmount } from '../paypal-utils';
import { PayPalService } from '../paypal.service';

/**
 * PayPal limits a single transaction-search query to a 31-day date range. Longer
 * ranges are split into windows of this size and stitched together.
 */
const MAX_WINDOW_DAYS = 31;
const MAX_WINDOW_MS = MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const TRANSACTIONS_PAGE_SIZE = 100;

/** A flattened, formatted PayPal transaction for reporting. */
export interface PayPalTransactionReport {
    transactionId?: string;
    status?: string;
    eventCode?: string;
    amount?: number;
    feeAmount?: number;
    currencyCode?: string;
    initiationDate?: string;
    updatedDate?: string;
}

export interface PayPalBalanceReport {
    currencyCode: string;
    primary: boolean;
    totalBalance: number;
    availableBalance?: number;
    withheldBalance?: number;
}

export interface PayPalBalancesReport {
    accountId?: string;
    asOfTime?: string;
    lastRefreshTime?: string;
    balances: PayPalBalanceReport[];
}

@Injectable()
export class PayPalReportingService {
    constructor(private paypalService: PayPalService) {}

    /**
     * Searches PayPal transactions within the given date range. Ranges longer than
     * 31 days are automatically split into windows and stitched together; each
     * window is fully paginated.
     *
     * Note: PayPal transactions can take up to 3 hours to appear, so this is
     * intended for reconciliation/accounting, not real-time payment confirmation.
     */
    async searchTransactions(
        ctx: RequestContext,
        startDate: Date,
        endDate: Date,
        transactionStatus?: string,
    ): Promise<PayPalTransactionReport[]> {
        if (startDate.getTime() > endDate.getTime()) {
            throw new UserInputError('startDate must be before endDate');
        }
        const reports: PayPalTransactionReport[] = [];
        for (const [windowStart, windowEnd] of this.splitIntoWindows(startDate, endDate)) {
            reports.push(...(await this.searchWindow(windowStart, windowEnd, transactionStatus)));
        }
        return reports;
    }

    async getBalances(
        ctx: RequestContext,
        asOfTime?: Date,
        currencyCode?: string,
    ): Promise<PayPalBalancesReport> {
        try {
            const { result } = await this.client().transactionSearch.searchBalances({
                asOfTime: asOfTime ? asOfTime.toISOString() : undefined,
                currencyCode,
            });
            return {
                accountId: result.accountId,
                asOfTime: result.asOfTime,
                lastRefreshTime: result.lastRefreshTime,
                balances: (result.balances ?? []).map(balance => ({
                    currencyCode: balance.currency,
                    primary: balance.primary ?? false,
                    totalBalance: this.toMinorUnits(balance.totalBalance),
                    availableBalance: this.toMinorUnitsOptional(balance.availableBalance),
                    withheldBalance: this.toMinorUnitsOptional(balance.withheldBalance),
                })),
            };
        } catch (e) {
            throw this.handleApiError(e, 'Failed to retrieve PayPal balances');
        }
    }

    private async searchWindow(
        windowStart: Date,
        windowEnd: Date,
        transactionStatus?: string,
    ): Promise<PayPalTransactionReport[]> {
        const reports: PayPalTransactionReport[] = [];
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
                for (const detail of result.transactionDetails ?? []) {
                    if (detail.transactionInfo) {
                        reports.push(this.mapTransaction(detail.transactionInfo));
                    }
                }
                totalPages = result.totalPages ?? 1;
                page++;
            } while (page <= totalPages);
        } catch (e) {
            throw this.handleApiError(
                e,
                `Failed to search PayPal transactions between ${windowStart.toISOString()} and ${windowEnd.toISOString()}`,
            );
        }
        return reports;
    }

    private mapTransaction(info: TransactionInformation): PayPalTransactionReport {
        return {
            transactionId: info.transactionId,
            status: info.transactionStatus,
            eventCode: info.transactionEventCode,
            amount: this.toMinorUnitsOptional(info.transactionAmount),
            feeAmount: this.toMinorUnitsOptional(info.feeAmount),
            currencyCode: info.transactionAmount?.currencyCode,
            initiationDate: info.transactionInitiationDate,
            updatedDate: info.transactionUpdatedDate,
        };
    }

    /**
     * Splits a date range into consecutive windows no longer than 31 days each.
     */
    private splitIntoWindows(startDate: Date, endDate: Date): Array<[Date, Date]> {
        const windows: Array<[Date, Date]> = [];
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

    private toMinorUnits(money: Money): number {
        if (!money?.value || !money.currencyCode) {
            return 0;
        }
        return fromPayPalAmount(money.value, money.currencyCode);
    }

    private toMinorUnitsOptional(money: Money | undefined): number | undefined {
        if (!money?.value || !money.currencyCode) {
            return undefined;
        }
        return fromPayPalAmount(money.value, money.currencyCode);
    }

    private client(): PayPalClient {
        return this.paypalService.getClient();
    }

    private handleApiError(e: unknown, context: string): Error {
        if (e instanceof ApiError) {
            const detail = typeof e.body === 'string' ? e.body : JSON.stringify(e.result ?? e.message);
            Logger.error(`${context}: [${e.statusCode}] ${detail}`, loggerCtx);
            return new InternalServerError(`${context} (PayPal error ${e.statusCode})`);
        }
        if (e instanceof UserInputError || e instanceof InternalServerError) {
            return e;
        }
        const message = e instanceof Error ? e.message : String(e);
        Logger.error(`${context}: ${message}`, loggerCtx);
        return new InternalServerError(context);
    }
}
