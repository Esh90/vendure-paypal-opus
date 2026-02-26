import { CustomFields, dummyPaymentHandler, LanguageCode } from '@vendure/core';

/**
 * Custom fields and payment handlers shared between:
 *   - e2e-vendure-config.ts  (Vite plugin — dashboard extension discovery)
 *   - global-setup.ts        (Vendure backend server for E2E tests)
 *
 * WHY THREE FILES?
 * These two consumers cannot share a single config file because they have
 * incompatible constraints:
 *
 *   1. e2e-vendure-config.ts imports FormInputsTestPlugin (@VendurePlugin
 *      decorator). This file is compiled by the dashboard Vite plugin's own
 *      TypeScript compiler — that works fine for simple decorators.
 *
 *   2. global-setup.ts additionally needs CustomHistoryEntryPlugin, which
 *      uses NestJS constructor injection (emitDecoratorMetadata). That
 *      requires SWC compilation — the Vite plugin's TS compiler cannot
 *      handle it. So CustomHistoryEntryPlugin is loaded via importWithSwc()
 *      and must NOT appear in any static import chain that the Vite plugin
 *      would try to compile.
 *
 *   3. The backend server uses defaultTestConfig (sqljs DB, test auth),
 *      while the Vite config uses dummy placeholder values for DB/auth
 *      that are never actually used.
 *
 * This file contains only the parts that are genuinely shared (custom fields
 * and payment handlers) with no plugin imports, so both consumers can safely
 * import it without side effects.
 */

export const e2eCustomFields: CustomFields = {
    Product: [
        // ── General tab (default) ──
        {
            name: 'infoUrl',
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'Info URL' }],
        },
        {
            name: 'weight',
            type: 'float',
            label: [{ languageCode: LanguageCode.en, value: 'Weight' }],
        },
        {
            name: 'reviewRating',
            type: 'int',
            label: [{ languageCode: LanguageCode.en, value: 'Review Rating' }],
        },
        {
            name: 'isDownloadable',
            type: 'boolean',
            label: [{ languageCode: LanguageCode.en, value: 'Downloadable' }],
        },
        {
            name: 'releaseDate',
            type: 'datetime',
            label: [{ languageCode: LanguageCode.en, value: 'Release Date' }],
        },
        {
            name: 'additionalInfo',
            type: 'text',
            label: [{ languageCode: LanguageCode.en, value: 'Additional Info' }],
        },
        {
            name: 'priority',
            type: 'string',
            label: [{ languageCode: LanguageCode.en, value: 'Priority' }],
            options: [{ value: 'low' }, { value: 'medium' }, { value: 'high' }],
        },
        // ── SEO tab ──
        {
            name: 'seoTitle',
            type: 'localeString',
            label: [{ languageCode: LanguageCode.en, value: 'SEO Title' }],
            ui: { tab: 'SEO' },
        },
        {
            name: 'seoDescription',
            type: 'localeText',
            label: [{ languageCode: LanguageCode.en, value: 'SEO Description' }],
            ui: { tab: 'SEO', fullWidth: true },
        },
        // ── Details tab ──
        {
            name: 'detailNotes',
            type: 'text',
            label: [{ languageCode: LanguageCode.en, value: 'Detail Notes' }],
            ui: { tab: 'Details', fullWidth: true },
        },
        // ── Lists tab ──
        {
            name: 'tags',
            type: 'string',
            list: true,
            label: [{ languageCode: LanguageCode.en, value: 'Tags' }],
            ui: { tab: 'Lists' },
        },
        // ── Struct tab ──
        {
            name: 'specifications',
            type: 'struct',
            label: [{ languageCode: LanguageCode.en, value: 'Specifications' }],
            ui: { tab: 'Struct' },
            fields: [
                {
                    name: 'material',
                    type: 'string',
                    label: [{ languageCode: LanguageCode.en, value: 'Material' }],
                },
                {
                    name: 'height',
                    type: 'float',
                    label: [{ languageCode: LanguageCode.en, value: 'Height' }],
                },
                {
                    name: 'isRecyclable',
                    type: 'boolean',
                    label: [{ languageCode: LanguageCode.en, value: 'Recyclable' }],
                },
                {
                    name: 'certifications',
                    type: 'string',
                    list: true,
                    label: [{ languageCode: LanguageCode.en, value: 'Certifications' }],
                },
            ],
        },
        {
            name: 'dimensions',
            type: 'struct',
            list: true,
            label: [{ languageCode: LanguageCode.en, value: 'Dimensions' }],
            ui: { tab: 'Struct' },
            fields: [
                {
                    name: 'dimensionName',
                    type: 'string',
                    label: [{ languageCode: LanguageCode.en, value: 'Dimension Name' }],
                },
                {
                    name: 'dimensionValue',
                    type: 'float',
                    label: [{ languageCode: LanguageCode.en, value: 'Dimension Value' }],
                },
                {
                    name: 'dimensionUnit',
                    type: 'string',
                    label: [{ languageCode: LanguageCode.en, value: 'Dimension Unit' }],
                },
            ],
        },
    ],
};

export const e2ePaymentMethodHandlers = [dummyPaymentHandler];
