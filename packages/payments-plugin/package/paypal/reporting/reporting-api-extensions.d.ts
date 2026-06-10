/**
 * Admin API extensions for PayPal transaction reporting. Data is fetched live
 * from PayPal and not persisted. Note: transactions can take up to 3 hours to
 * appear and are intended for reconciliation, not real-time confirmation.
 */
export declare const adminApiExtensions: import("graphql").DocumentNode;
