import { ActiveOrderService, RequestContext } from '@vendure/core';
import { CreatePayPalOrderResult, PayPalService } from './paypal.service';
export declare class PayPalShopResolver {
    private paypalService;
    private activeOrderService;
    constructor(paypalService: PayPalService, activeOrderService: ActiveOrderService);
    createPayPalOrder(ctx: RequestContext): Promise<CreatePayPalOrderResult>;
}
