import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalTeardown() {
    // Remove the E2E-only test page that was copied during globalSetup.
    const testPageDest = path.join(
        __dirname,
        '..',
        'src',
        'app',
        'routes',
        '_authenticated',
        'form-inputs-test.tsx',
    );
    rmSync(testPageDest, { force: true });

    const server = (globalThis as any).__VENDURE_SERVER__;
    if (server) {
        await server.destroy();
    }
}
