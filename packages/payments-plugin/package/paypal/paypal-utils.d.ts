/**
 * Returns the number of decimal places used by the given currency, matching the
 * precision Vendure uses when storing the amount in minor units.
 */
export declare function getCurrencyDecimalPlaces(currencyCode: string): number;
/**
 * Converts a Vendure amount (an integer in the currency's minor units, e.g.
 * `1050` for `$10.50`) into the decimal string representation required by the
 * PayPal API (e.g. `"10.50"`).
 */
export declare function toPayPalAmount(minorUnits: number, currencyCode: string): string;
/**
 * Converts a decimal amount string returned by the PayPal API (e.g. `"10.50"`)
 * back into a Vendure integer minor-unit amount (e.g. `1050`).
 */
export declare function fromPayPalAmount(value: string, currencyCode: string): number;
