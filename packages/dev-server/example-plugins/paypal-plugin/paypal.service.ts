import { Injectable } from '@nestjs/common';
import { CheckoutPaymentIntent, PaypalExperienceUserAction } from '@paypal/paypal-server-sdk';
import { ID, Logger, OrderService, RequestContext, UserInputError } from '@vendure/core';
import { getOrdersController } from './paypal-client';
import { toPayPalAmount } from './utils/currency';

const loggerCtx = 'PayPalService';

@Injectable()
export class PayPalService {
    constructor(private readonly orderService: OrderService) {}

    /**
     * UC1 — Creates a PayPal order with CAPTURE intent.
     * Returns the PayPal order ID and the buyer-approval URL.
     */
    async createPayPalOrder(ctx: RequestContext): Promise<{ paypalOrderId: string; approvalUrl: string }> {
        return this.buildPayPalOrder(ctx, CheckoutPaymentIntent.Capture);
    }

    /**
     * UC2 — Creates a PayPal order with AUTHORIZE intent.
     * Funds are reserved but not moved until the merchant explicitly captures.
     * Returns the PayPal order ID and the buyer-approval URL.
     */
    async createPayPalOrderForAuthorization(
        ctx: RequestContext,
    ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
        return this.buildPayPalOrder(ctx, CheckoutPaymentIntent.Authorize);
    }

    private async buildPayPalOrder(
        ctx: RequestContext,
        intent: CheckoutPaymentIntent,
    ): Promise<{ paypalOrderId: string; approvalUrl: string }> {
        const activeOrderId = ctx.session?.activeOrderId;
        if (!activeOrderId) {
            throw new UserInputError('No active order found. Add items to your cart first.');
        }

        const order = await this.orderService.findOne(ctx, activeOrderId as ID);
        if (!order) {
            throw new UserInputError(`Active order ${activeOrderId} not found.`);
        }

        const currencyCode = String(order.currencyCode);
        const value = toPayPalAmount(order.totalWithTax, currencyCode);

        Logger.info(
            `Creating PayPal order (intent: ${intent}) for Vendure order ${order.code}: ${currencyCode} ${value}`,
            loggerCtx,
        );

        const returnUrl = process.env.PAYPAL_RETURN_URL ?? 'http://localhost:3000/checkout/paypal-return';
        const cancelUrl = process.env.PAYPAL_CANCEL_URL ?? 'http://localhost:3000/checkout/paypal-cancel';

        const ordersController = getOrdersController();

        const response = await ordersController.createOrder({
            body: {
                intent,
                purchaseUnits: [
                    {
                        referenceId: order.code,
                        amount: {
                            currencyCode,
                            value,
                        },
                    },
                ],
                paymentSource: {
                    paypal: {
                        experienceContext: {
                            returnUrl,
                            cancelUrl,
                            userAction: PaypalExperienceUserAction.PayNow,
                        },
                    },
                },
            },
            prefer: 'return=representation',
        });

        const paypalOrder = response.result;

        if (!paypalOrder?.id) {
            throw new Error('PayPal did not return an order ID.');
        }

        const approvalLink = paypalOrder.links?.find(
            link => link.rel === 'payer-action' || link.rel === 'approve',
        );

        if (!approvalLink?.href) {
            throw new Error('PayPal order was created but no buyer-approval URL was returned.');
        }

        Logger.info(
            `PayPal order created (intent: ${intent}). Order ID: ${paypalOrder.id}, Vendure order: ${order.code}`,
            loggerCtx,
        );

        return {
            paypalOrderId: paypalOrder.id,
            approvalUrl: approvalLink.href,
        };
    }
}
