"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrencyDecimalPlaces = getCurrencyDecimalPlaces;
exports.toPayPalAmount = toPayPalAmount;
exports.fromPayPalAmount = fromPayPalAmount;
/**
 * ISO 4217 currencies that have no minor unit (i.e. amounts are whole numbers).
 * For these, Vendure's integer "minor unit" amount is already the major amount.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
    'BIF',
    'CLP',
    'DJF',
    'GNF',
    'JPY',
    'KMF',
    'KRW',
    'MGA',
    'PYG',
    'RWF',
    'UGX',
    'VND',
    'VUV',
    'XAF',
    'XOF',
    'XPF',
]);
/**
 * ISO 4217 currencies that use three decimal places.
 */
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);
/**
 * Returns the number of decimal places used by the given currency, matching the
 * precision Vendure uses when storing the amount in minor units.
 */
function getCurrencyDecimalPlaces(currencyCode) {
    const code = currencyCode.toUpperCase();
    if (ZERO_DECIMAL_CURRENCIES.has(code)) {
        return 0;
    }
    if (THREE_DECIMAL_CURRENCIES.has(code)) {
        return 3;
    }
    return 2;
}
/**
 * Converts a Vendure amount (an integer in the currency's minor units, e.g.
 * `1050` for `$10.50`) into the decimal string representation required by the
 * PayPal API (e.g. `"10.50"`).
 */
function toPayPalAmount(minorUnits, currencyCode) {
    const decimals = getCurrencyDecimalPlaces(currencyCode);
    const factor = 10 ** decimals;
    // Round defensively to guard against floating point artefacts before formatting.
    const major = Math.round(minorUnits) / factor;
    return major.toFixed(decimals);
}
/**
 * Converts a decimal amount string returned by the PayPal API (e.g. `"10.50"`)
 * back into a Vendure integer minor-unit amount (e.g. `1050`).
 */
function fromPayPalAmount(value, currencyCode) {
    const decimals = getCurrencyDecimalPlaces(currencyCode);
    const factor = 10 ** decimals;
    return Math.round(Number.parseFloat(value) * factor);
}
//# sourceMappingURL=paypal-utils.js.map