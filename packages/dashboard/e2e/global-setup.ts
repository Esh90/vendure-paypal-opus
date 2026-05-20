import { mergeConfig } from '@vendure/core';
import {
    createTestEnvironment,
    testConfig as defaultTestConfig,
    registerInitializer,
    SqljsInitializer,
} from '@vendure/testing';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { VENDURE_PORT } from './constants.js';
import { e2eCustomFields, e2ePaymentMethodHandlers } from './fixtures/e2e-shared-config.js';
import { initialData } from './fixtures/initial-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

registerInitializer('sqljs', new SqljsInitializer(path.join(__dirname, '__data__')));

/**
 * Compiles a TypeScript fixture with SWC so that NestJS parameter decorators
 * and emitDecoratorMetadata work correctly. Playwright's built-in transpiler
 * (esbuild/Babel) does not support these features.
 */
async function importWithSwc<T>(fixturePath: string): Promise<T> {
    const { transformFileSync } = await import('@swc/core');
    const { code } = transformFileSync(fixturePath, {
        jsc: {
            parser: { syntax: 'typescript', decorators: true },
            transform: { decoratorMetadata: true, useDefineForClassFields: false },
            target: 'es2017',
        },
        module: { type: 'es6' },
    });
    const outDir = path.join(__dirname, 'fixtures', '.compiled');
    const outFile = path.join(outDir, path.basename(fixturePath).replace(/\.ts$/, '.mjs'));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(outFile, code);
    return import(pathToFileURL(outFile).href) as Promise<T>;
}

export default async function globalSetup() {
    // CustomHistoryEntryPlugin uses NestJS constructor injection which requires
    // SWC compilation (emitDecoratorMetadata). It is loaded dynamically here
    // rather than statically imported because Playwright's built-in TypeScript
    // transpiler (esbuild/Babel) does not support emitDecoratorMetadata.
    const { CustomHistoryEntryPlugin } = await importWithSwc<{
        CustomHistoryEntryPlugin: new () => unknown;
    }>(path.join(__dirname, 'fixtures', 'custom-history-entry-plugin.ts'));

    // AssetServerPlugin uses NestJS decorators and class-extends-from-core
    // patterns that Playwright's static-ESM import path cannot resolve
    // (hashed-asset-naming-strategy extends a base class from @vendure/core
    // that ends up `undefined` under Babel transform). Pull it in via Node's
    // native loader at runtime to side-step the transform path.
    const { AssetServerPlugin } =
        (await import('@vendure/asset-server-plugin')) as typeof import('@vendure/asset-server-plugin');

    // Assets uploaded via createAssets during tests are written here. Wipe on
    // each setup so reruns start from a clean directory; the suite assumes
    // no asset state survives between full test runs.
    const assetUploadDir = path.join(__dirname, '__data__/assets');
    rmSync(assetUploadDir, { recursive: true, force: true });
    mkdirSync(assetUploadDir, { recursive: true });

    const config = mergeConfig(defaultTestConfig, {
        apiOptions: {
            port: VENDURE_PORT,
        },
        paymentOptions: {
            paymentMethodHandlers: e2ePaymentMethodHandlers,
        },
        // AssetServerPlugin is required so that uploaded assets resolve to a
        // proper http URL (the default test-asset storage strategy emits a
        // `test-url/test-assets/...` placeholder that `VendureImage` cannot
        // parse with `new URL(...)`). Tests that exercise the asset preview
        // dialog need this to render.
        plugins: [
            CustomHistoryEntryPlugin,
            // Cast to any — the dynamic-import return type cannot satisfy the
            // mergeConfig `DeepPartial<plugin>` shape that includes nestjs
            // DynamicModule, but the runtime value is correct.
            AssetServerPlugin.init({ route: 'assets', assetUploadDir }) as any,
        ],
        customFields: e2eCustomFields,
    });

    // mergeConfig won't replace a boolean with an object, so set CORS explicitly.
    // The dashboard's fetch uses credentials: 'include', which requires the server
    // to reflect the request origin (not wildcard *) and set credentials: true.
    config.apiOptions.cors = {
        origin: true,
        credentials: true,
    };

    const { server } = createTestEnvironment(config);
    await server.init({
        initialData,
        productsCsvPath: path.join(__dirname, '../../core/e2e/fixtures/e2e-products-full.csv'),
        customerCount: 5,
    });
    (globalThis as any).__VENDURE_SERVER__ = server;
}
