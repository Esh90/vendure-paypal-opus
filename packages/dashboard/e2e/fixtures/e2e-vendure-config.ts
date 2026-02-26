import { VendureConfig } from '@vendure/core';

import { FormInputsTestPlugin } from './form-inputs-test-plugin';

/**
 * Vendure config used by the Vite plugin during E2E tests.
 *
 * This is NOT used to start the backend server (that's handled by
 * global-setup.ts). It is only used by the dashboard's Vite plugin
 * to discover dashboard extensions via config introspection.
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
        paymentMethodHandlers: [],
    },
    plugins: [FormInputsTestPlugin],
};
