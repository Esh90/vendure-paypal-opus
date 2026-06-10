import { CheckoutPaymentIntent } from '@paypal/paypal-server-sdk';
import { Order, PaymentMethod, PaymentMethodService, RequestContext } from '@vendure/core';
import { PayPalPluginOptions } from './types';
/**
 * The result of creating a PayPal order, returned to the storefront so it can
 * drive the buyer-approval step (either via redirect or the embedded Smart
 * Payment Buttons).
 */
export interface CreatePayPalOrderResult {
    id: string;
    status: string;
    approveUrl?: string;
}
/**
 * The result of capturing a PayPal order, used by the payment handler to record
 * the payment against the Vendure order.
 */
export interface CapturePayPalOrderResult {
    orderStatus: string;
    captureId: string;
    captureStatus: string;
    amount: number;
    currencyCode: string;
}
/**
 * The result of authorizing a PayPal order, used by the payment handler to record
 * an authorized (not yet captured) payment against the Vendure order.
 */
export interface AuthorizePayPalOrderResult {
    orderStatus: string;
    authorizationId: string;
    authorizationStatus: string;
}
/**
 * The result of capturing a previously-authorized PayPal payment.
 */
export interface CaptureAuthorizationResult {
    captureId: string;
    captureStatus: string;
}
/**
 * The result of voiding a previously-authorized PayPal payment. The status may be
 * absent when PayPal returns an empty body for the void.
 */
export interface VoidAuthorizationResult {
    authorizationStatus?: string;
}
/**
 * The result of refunding a captured PayPal payment.
 */
export interface RefundCaptureResult {
    refundId: string;
    refundStatus: string;
}
export declare class PayPalService {
    private options;
    private paymentMethodService;
    private client;
    private warnedAboutDefaultUrls;
    constructor(options: PayPalPluginOptions, paymentMethodService: PaymentMethodService);
    /**
     * Creates a PayPal order for the given Vendure order. The order's intent
     * (`CAPTURE` or `AUTHORIZE`) is taken from the configured PayPal payment
     * method. The returned order is in the `CREATED` state and must be approved
     * by the buyer before it can be captured or authorized.
     */
    createOrder(ctx: RequestContext, order: Order): Promise<CreatePayPalOrderResult>;
    /**
     * Retrieves the intent (`CAPTURE` or `AUTHORIZE`) that a PayPal order was
     * created with. This is the authoritative source of truth for how an
     * approved order must be processed, ensuring the capture/authorize action
     * always matches the order and avoiding `ACTION_DOES_NOT_MATCH_INTENT`
     * (HTTP 422) errors.
     */
    getOrderIntent(ctx: RequestContext, paypalOrderId: string): Promise<CheckoutPaymentIntent>;
    /**
     * Captures a previously-approved PayPal order, moving the funds from the
     * buyer to the merchant.
     */
    captureOrder(ctx: RequestContext, paypalOrderId: string): Promise<CapturePayPalOrderResult>;
    private extractCaptureResult;
    /**
     * Authorizes a previously-approved PayPal order, reserving the funds without
     * capturing them. The returned authorization can later be captured (on
     * fulfilment) via {@link captureAuthorization} or voided via
     * {@link voidAuthorization}.
     */
    authorizeOrder(ctx: RequestContext, paypalOrderId: string): Promise<AuthorizePayPalOrderResult>;
    private extractAuthorizeResult;
    /**
     * Captures the full amount of a previously-authorized PayPal payment. This is
     * a final capture, meaning no further captures can be made against the
     * authorization.
     */
    captureAuthorization(ctx: RequestContext, authorizationId: string): Promise<CaptureAuthorizationResult>;
    /**
     * Voids (cancels) a previously-authorized PayPal payment, releasing the
     * reserved funds back to the buyer. This is only possible for authorizations
     * that have not been fully captured; PayPal returns an error otherwise.
     *
     * A successful void may return an empty (HTTP 204) body, so success is
     * inferred from the absence of an error rather than the returned status.
     * Returns the authorization status when PayPal includes it (e.g. `VOIDED`).
     */
    voidAuthorization(ctx: RequestContext, authorizationId: string): Promise<VoidAuthorizationResult>;
    /**
     * Refunds a captured PayPal payment. When `amount` is omitted, the full
     * captured amount is refunded; when provided, a partial refund of that
     * amount is issued. Multiple partial refunds can be made against the same
     * capture, up to the originally-captured total.
     */
    refundCapture(ctx: RequestContext, captureId: string, amount?: {
        value: string;
        currencyCode: string;
    }): Promise<RefundCaptureResult>;
    /**
     * Returns the enabled `PaymentMethod` whose handler is the PayPal handler, or
     * throws if none exists.
     */
    getPaymentMethod(ctx: RequestContext): Promise<PaymentMethod>;
    /**
     * Ensures that the given PayPal payment method is eligible for the order
     * before a PayPal order is created.
     */
    private assertPaymentMethodEligible;
    /**
     * Reads the configured checkout intent (`capture` or `authorize`) from the
     * PayPal payment method's handler arguments, defaulting to `capture`.
     */
    private getConfiguredIntent;
    /**
     * Resolves the buyer-approval redirect URLs, falling back to localhost
     * defaults (intended for sandbox/local development) when they are not
     * configured. A warning is logged once if the defaults are used, since real
     * storefront URLs should be configured for production.
     */
    private resolveRedirectUrls;
    private getClient;
    /**
     * Normalises errors thrown by the PayPal SDK into a logged Vendure error. The
     * original PayPal error body is logged for troubleshooting, while a concise
     * message is surfaced to the caller.
     */
    private handleApiError;
}
