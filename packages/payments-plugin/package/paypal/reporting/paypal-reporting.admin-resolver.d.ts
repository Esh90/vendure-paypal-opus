import { RequestContext } from '@vendure/core';
import { PayPalBalancesReport, PayPalReportingService, PayPalTransactionReport } from './paypal-reporting.service';
export declare class PayPalReportingAdminResolver {
    private reportingService;
    constructor(reportingService: PayPalReportingService);
    payPalTransactions(ctx: RequestContext, args: {
        startDate: string | Date;
        endDate: string | Date;
        transactionStatus?: string;
    }): Promise<PayPalTransactionReport[]>;
    payPalBalances(ctx: RequestContext, args: {
        asOfTime?: string | Date;
        currencyCode?: string;
    }): Promise<PayPalBalancesReport>;
    private parseDate;
}
