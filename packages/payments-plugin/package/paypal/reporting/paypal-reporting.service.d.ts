import { RequestContext } from '@vendure/core';
import { PayPalService } from '../paypal.service';
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
export declare class PayPalReportingService {
    private paypalService;
    constructor(paypalService: PayPalService);
    /**
     * Searches PayPal transactions within the given date range. Ranges longer than
     * 31 days are automatically split into windows and stitched together; each
     * window is fully paginated.
     *
     * Note: PayPal transactions can take up to 3 hours to appear, so this is
     * intended for reconciliation/accounting, not real-time payment confirmation.
     */
    searchTransactions(ctx: RequestContext, startDate: Date, endDate: Date, transactionStatus?: string): Promise<PayPalTransactionReport[]>;
    getBalances(ctx: RequestContext, asOfTime?: Date, currencyCode?: string): Promise<PayPalBalancesReport>;
    private searchWindow;
    private mapTransaction;
    /**
     * Splits a date range into consecutive windows no longer than 31 days each.
     */
    private splitIntoWindows;
    private toMinorUnits;
    private toMinorUnitsOptional;
    private client;
    private handleApiError;
}
