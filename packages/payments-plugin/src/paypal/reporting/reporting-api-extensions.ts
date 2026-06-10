import { gql } from 'graphql-tag';

/**
 * Admin API extensions for PayPal transaction reporting. Data is fetched live
 * from PayPal and not persisted. Note: transactions can take up to 3 hours to
 * appear and are intended for reconciliation, not real-time confirmation.
 */
export const adminApiExtensions = gql`
    type PayPalTransaction {
        transactionId: String
        status: String
        eventCode: String
        "Transaction amount in the currency's minor units (e.g. cents)."
        amount: Int
        feeAmount: Int
        currencyCode: String
        initiationDate: String
        updatedDate: String
    }

    type PayPalBalance {
        currencyCode: String!
        primary: Boolean!
        totalBalance: Int!
        availableBalance: Int
        withheldBalance: Int
    }

    type PayPalBalances {
        accountId: String
        asOfTime: String
        lastRefreshTime: String
        balances: [PayPalBalance!]!
    }

    extend type Query {
        "Search PayPal transactions within a date range (ranges over 31 days are split and stitched automatically)."
        payPalTransactions(
            startDate: DateTime!
            endDate: DateTime!
            transactionStatus: String
        ): [PayPalTransaction!]!
        "Look up PayPal account balances, optionally as of a specific time or filtered by currency."
        payPalBalances(asOfTime: DateTime, currencyCode: String): PayPalBalances!
    }
`;
