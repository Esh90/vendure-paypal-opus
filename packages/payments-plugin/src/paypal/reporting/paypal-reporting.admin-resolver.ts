import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, Permission, RequestContext, UserInputError } from '@vendure/core';

import {
    PayPalBalancesReport,
    PayPalReportingService,
    PayPalTransactionReport,
} from './paypal-reporting.service';

@Resolver()
export class PayPalReportingAdminResolver {
    constructor(private reportingService: PayPalReportingService) {}

    @Query()
    @Allow(Permission.ReadOrder)
    payPalTransactions(
        @Ctx() ctx: RequestContext,
        @Args() args: { startDate: string | Date; endDate: string | Date; transactionStatus?: string },
    ): Promise<PayPalTransactionReport[]> {
        return this.reportingService.searchTransactions(
            ctx,
            this.parseDate(args.startDate, 'startDate'),
            this.parseDate(args.endDate, 'endDate'),
            args.transactionStatus,
        );
    }

    @Query()
    @Allow(Permission.ReadOrder)
    payPalBalances(
        @Ctx() ctx: RequestContext,
        @Args() args: { asOfTime?: string | Date; currencyCode?: string },
    ): Promise<PayPalBalancesReport> {
        return this.reportingService.getBalances(
            ctx,
            args.asOfTime != null ? this.parseDate(args.asOfTime, 'asOfTime') : undefined,
            args.currencyCode,
        );
    }

    private parseDate(value: string | Date, field: string): Date {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) {
            throw new UserInputError(`Invalid date provided for "${field}"`);
        }
        return date;
    }
}
