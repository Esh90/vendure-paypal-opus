import { OnApplicationBootstrap } from '@nestjs/common';
import { EventBus, Fulfillment, FulfillmentService, RequestContext, TransactionalConnection } from '@vendure/core';
import { PayPalService } from '../paypal.service';
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
export declare class PayPalFulfillmentService implements OnApplicationBootstrap {
    private eventBus;
    private connection;
    private fulfillmentService;
    private paypalService;
    constructor(eventBus: EventBus, connection: TransactionalConnection, fulfillmentService: FulfillmentService, paypalService: PayPalService);
    onApplicationBootstrap(): void;
    /**
     * Pushes the fulfillment's tracking details to PayPal for every order in the
     * fulfillment that was paid via PayPal.
     */
    pushTracking(ctx: RequestContext, fulfillment: Fulfillment): Promise<void>;
    private createTracking;
    private getOrdersForFulfillment;
    private findPayPalPayment;
    private normalizeApiError;
}
