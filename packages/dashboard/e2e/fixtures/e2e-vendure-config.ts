import { VendureConfig } from '@vendure/core';

import { e2eCustomFields, e2ePaymentMethodHandlers } from './e2e-shared-config';
import { FormInputsTestPlugin } from './form-inputs-test-plugin';

/**
 * Vendure config for the Vite plugin during E2E tests.
 *
 * This is NOT used to start a Vendure server. The dashboard's Vite plugin
 * compiles this file to discover @VendurePlugin decorators with `dashboard`
 * entry points (e.g. FormInputsTestPlugin). The dbConnectionOptions and
 * authOptions are dummy placeholders required by the VendureConfig type.
 *
 * Shared config (custom fields, payment handlers) is imported from
 * e2e-shared-config.ts — see that file for why the config is split.
 */
export const config: VendureConfig = {
    apiOptions: {
        port: 3000,
    },
    authOptions: {
        tokenMethod: 'bearer',
    },
    dbConnectionOptions: {
        type: 'postgres',
    },
    paymentOptions: {
        paymentMethodHandlers: e2ePaymentMethodHandlers,
    },
    plugins: [FormInputsTestPlugin],
    customFields: e2eCustomFields,
};
