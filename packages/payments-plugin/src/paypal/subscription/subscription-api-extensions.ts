import { gql } from 'graphql-tag';

const sharedTypes = gql`
    type PayPalBillingPlan implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        paypalPlanId: String!
        paypalProductId: String!
        name: String!
        description: String
        intervalUnit: String!
        intervalCount: Int!
        totalCycles: Int!
        priceAmount: Int!
        currencyCode: String!
        paymentFailureThreshold: Int!
        status: String!
    }

    type PayPalSubscription implements Node {
        id: ID!
        createdAt: DateTime!
        updatedAt: DateTime!
        paypalSubscriptionId: String!
        paypalPlanId: String!
        status: String!
        approveUrl: String
        customerEmail: String
        customerId: String
        failedPaymentsCount: Int!
        lastSyncedAt: DateTime
    }
`;

export const adminApiExtensions = gql`
    ${sharedTypes}

    input CreatePayPalBillingPlanInput {
        productId: String!
        name: String!
        description: String
        intervalUnit: String!
        intervalCount: Int!
        totalCycles: Int
        priceAmount: Int!
        currencyCode: String!
        paymentFailureThreshold: Int
    }

    input UpdatePayPalBillingPlanInput {
        priceAmount: Int
        paymentFailureThreshold: Int
    }

    extend type Query {
        payPalBillingPlans: [PayPalBillingPlan!]!
        payPalSubscriptions: [PayPalSubscription!]!
        payPalSubscription(id: ID!): PayPalSubscription
    }

    extend type Mutation {
        createPayPalBillingPlan(input: CreatePayPalBillingPlanInput!): PayPalBillingPlan!
        activatePayPalBillingPlan(id: ID!): PayPalBillingPlan!
        deactivatePayPalBillingPlan(id: ID!): PayPalBillingPlan!
        updatePayPalBillingPlan(id: ID!, input: UpdatePayPalBillingPlanInput!): PayPalBillingPlan!
        cancelPayPalSubscription(id: ID!, reason: String): PayPalSubscription!
        retryPayPalSubscriptionPayment(id: ID!): PayPalSubscription!
        syncPayPalSubscription(id: ID!): PayPalSubscription!
    }
`;

export const shopApiExtensions = gql`
    type PayPalSubscriptionResult {
        id: ID!
        paypalSubscriptionId: String!
        status: String!
        approveUrl: String
    }

    extend type Mutation {
        createPayPalSubscription(planId: ID!): PayPalSubscriptionResult!
        activatePayPalSubscription(id: ID!): PayPalSubscriptionResult!
    }
`;
