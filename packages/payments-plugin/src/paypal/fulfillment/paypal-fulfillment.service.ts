import { OnApplicationBootstrap } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { ApiError, ShipmentCarrier } from '@paypal/paypal-server-sdk';
import {
    EventBus,
    Fulfillment,
    FulfillmentStateTransitionEvent,
    FulfillmentService,
    ID,
    Logger,
    Order,
    OrderLine,
    Payment,
    RequestContext,
    TransactionalConnection,
} from '@vendure/core';
import { In } from 'typeorm';

import { loggerCtx } from '../constants';
import { PayPalService } from '../paypal.service';

/**
 * The fulfillment state that triggers pushing tracking to PayPal.
 */
const TRACK_ON_STATE = 'Shipped';

/**
 * @description
 * Subscribes to {@link FulfillmentStateTransitionEvent} and, when a fulfillment is
 * marked as shipped, pushes the carrier and tracking number to PayPal so the
 * buyer can see shipment tracking in their PayPal account.
 *
 * This has no custom endpoints or entities — it reacts to Vendure's fulfillment
 * lifecycle. Failures are logged but never interrupt the merchant's fulfillment
 * flow (the event is handled after the transition has committed).
 */
@Injectable()
export class PayPalFulfillmentService implements OnApplicationBootstrap {
    constructor(
        private eventBus: EventBus,
        private connection: TransactionalConnection,
        private fulfillmentService: FulfillmentService,
        private paypalService: PayPalService,
    ) {}

    onApplicationBootstrap(): void {
        this.eventBus.ofType(FulfillmentStateTransitionEvent).subscribe(event => {
            if (event.toState === TRACK_ON_STATE) {
                // Fire-and-forget: tracking is best-effort and must not block fulfillment.
                void this.pushTracking(event.ctx, event.fulfillment).catch(e => {
                    Logger.error(
                        `Failed to push PayPal tracking for fulfillment ${event.fulfillment.id}: ${
                            e instanceof Error ? e.message : String(e)
                        }`,
                        loggerCtx,
                    );
                });
            }
        });
    }

    /**
     * Pushes the fulfillment's tracking details to PayPal for every order in the
     * fulfillment that was paid via PayPal.
     */
    async pushTracking(ctx: RequestContext, fulfillment: Fulfillment): Promise<void> {
        const trackingNumber = fulfillment.trackingCode?.trim();
        if (!trackingNumber) {
            Logger.verbose(
                `Fulfillment ${fulfillment.id} has no tracking code; skipping PayPal tracking`,
                loggerCtx,
            );
            return;
        }

        const orders = await this.getOrdersForFulfillment(ctx, fulfillment.id);
        for (const order of orders) {
            const payment = this.findPayPalPayment(order);
            if (!payment) {
                continue;
            }
            const paypalOrderId = payment.metadata?.paypalOrderId as string | undefined;
            const captureId = payment.metadata?.captureId as string | undefined;
            if (!paypalOrderId || !captureId) {
                Logger.warn(
                    `PayPal payment ${payment.id} on order ${order.code} is missing paypalOrderId/captureId; cannot push tracking`,
                    loggerCtx,
                );
                continue;
            }
            await this.createTracking(paypalOrderId, captureId, trackingNumber, fulfillment.method);
            Logger.verbose(
                `Pushed PayPal tracking ${trackingNumber} for order ${order.code} (capture ${captureId})`,
                loggerCtx,
            );
        }
    }

    private async createTracking(
        paypalOrderId: string,
        captureId: string,
        trackingNumber: string,
        method?: string,
    ): Promise<void> {
        try {
            await this.paypalService.getClient().orders.createOrderTracking({
                id: paypalOrderId,
                body: {
                    captureId,
                    trackingNumber: trackingNumber.slice(0, 64),
                    // Vendure has no structured carrier, so the fulfillment method name
                    // is reported via the OTHER carrier.
                    carrier: ShipmentCarrier.Other,
                    carrierNameOther: (method && method.length ? method : 'Other').slice(0, 64),
                    notifyPayer: true,
                },
            });
        } catch (e) {
            throw this.normalizeApiError(e, paypalOrderId, captureId);
        }
    }

    private async getOrdersForFulfillment(ctx: RequestContext, fulfillmentId: ID): Promise<Order[]> {
        const fulfillmentLines = await this.fulfillmentService.getFulfillmentLines(ctx, fulfillmentId);
        const orderLineIds = [...new Set(fulfillmentLines.map(line => line.orderLineId))];
        if (orderLineIds.length === 0) {
            return [];
        }
        const orderLines = await this.connection.getRepository(ctx, OrderLine).find({
            where: { id: In(orderLineIds) },
            relations: ['order'],
        });
        const orderIds = [...new Set(orderLines.map(line => line.order.id))];
        if (orderIds.length === 0) {
            return [];
        }
        return this.connection.getRepository(ctx, Order).find({
            where: { id: In(orderIds) },
            relations: ['payments'],
        });
    }

    private findPayPalPayment(order: Order): Payment | undefined {
        return (order.payments ?? []).find(
            payment =>
                payment.state === 'Settled' &&
                payment.metadata?.paypalOrderId != null &&
                payment.metadata?.captureId != null,
        );
    }

    private normalizeApiError(e: unknown, paypalOrderId: string, captureId: string): Error {
        const context = `Failed to create PayPal tracking for order ${paypalOrderId} (capture ${captureId})`;
        if (e instanceof ApiError) {
            const detail = typeof e.body === 'string' ? e.body : JSON.stringify(e.result ?? e.message);
            Logger.error(`${context}: [${e.statusCode}] ${detail}`, loggerCtx);
            return new Error(`${context} (PayPal error ${e.statusCode})`);
        }
        return e instanceof Error ? e : new Error(`${context}: ${String(e)}`);
    }
}
