import { expect, test } from '@playwright/test';

import { VENDURE_PORT } from '../../constants.js';

// #4722 — The focal-point editor was only available on the standalone Asset
// detail route. The fix wires it through the shared `AssetPreview` (and
// therefore the dialog used by Product / Variant detail pages), with a
// callback up to `EntityAssets` so re-opening the dialog after a save shows
// the new value rather than the stale one from the parent detail query.
test.describe('Issue 4722 — focal point editor in shared asset preview dialog', () => {
    interface SetupResult {
        productId: string;
        assetId: string;
        originalFocalPoint: { x: number; y: number } | null;
    }

    let setup: SetupResult;

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        setup = await page.evaluate(async vendurePort => {
            const apiUrl = `http://localhost:${vendurePort}/admin-api`;
            const sessionToken = localStorage.getItem('vendure-session-token');
            if (!sessionToken) throw new Error('No vendure-session-token');
            const post = async (query: string, variables: Record<string, unknown>) => {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'content-type': 'application/json',
                        authorization: `Bearer ${sessionToken}`,
                    },
                    body: JSON.stringify({ query, variables }),
                });
                const json = await res.json();
                if (json.errors?.length) throw new Error(`Admin API: ${JSON.stringify(json.errors)}`);
                return json.data;
            };

            // The e2e populate seeds products but not assets, so upload a
            // 1×1 transparent PNG via the multipart `createAssets` mutation.
            const png1x1Base64 =
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
            const binary = atob(png1x1Base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const formData = new FormData();
            formData.append(
                'operations',
                JSON.stringify({
                    query: `mutation($input: [CreateAssetInput!]!) {
                        createAssets(input: $input) {
                            ...on Asset { id name focalPoint { x y } }
                            ...on MimeTypeError { message }
                        }
                    }`,
                    variables: { input: [{ file: null }] },
                }),
            );
            formData.append('map', JSON.stringify({ '0': ['variables.input.0.file'] }));
            formData.append('0', new Blob([bytes], { type: 'image/png' }), `oss-530-${Date.now()}.png`);
            const uploadRes = await fetch(apiUrl, {
                method: 'POST',
                credentials: 'include',
                headers: { authorization: `Bearer ${sessionToken}` },
                body: formData,
            });
            const uploadJson = await uploadRes.json();
            if (uploadJson.errors?.length) {
                throw new Error(`Asset upload: ${JSON.stringify(uploadJson.errors)}`);
            }
            const seedAsset = uploadJson.data.createAssets.find((a: any) => a.id);
            if (!seedAsset) {
                throw new Error(`Asset upload returned no Asset: ${JSON.stringify(uploadJson.data)}`);
            }

            // Spin up a dedicated product so the test is isolated from
            // anything else mutating the seed products.
            const ts = Date.now();
            const product = await post(
                `mutation($input: CreateProductInput!) { createProduct(input: $input) { id } }`,
                {
                    input: {
                        featuredAssetId: seedAsset.id,
                        assetIds: [seedAsset.id],
                        translations: [
                            {
                                languageCode: 'en',
                                name: `OSS-530 Test Product ${ts}`,
                                slug: `oss-530-${ts}`,
                                description: '',
                            },
                        ],
                    },
                },
            );

            return {
                productId: product.createProduct.id as string,
                assetId: seedAsset.id as string,
                originalFocalPoint: seedAsset.focalPoint ?? null,
            };
        }, VENDURE_PORT);
    });

    test.afterEach(async ({ page }) => {
        // Reset the asset back to its original focal point so the seed isn't
        // polluted across runs in the (rare) case that the playwright config
        // reuses the global setup DB.
        await page.evaluate(
            async args => {
                const { vendurePort, assetId, originalFocalPoint } = args;
                const apiUrl = `http://localhost:${vendurePort}/admin-api`;
                const sessionToken = localStorage.getItem('vendure-session-token');
                if (!sessionToken) return;
                await fetch(apiUrl, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'content-type': 'application/json',
                        authorization: `Bearer ${sessionToken}`,
                    },
                    body: JSON.stringify({
                        query: `mutation($input: UpdateAssetInput!) { updateAsset(input: $input) { id } }`,
                        variables: { input: { id: assetId, focalPoint: originalFocalPoint } },
                    }),
                });
            },
            {
                vendurePort: VENDURE_PORT,
                assetId: setup.assetId,
                originalFocalPoint: setup.originalFocalPoint,
            },
        );
    });

    test('should let the user set a focal point from the preview dialog and persist across re-open', async ({
        page,
    }) => {
        test.setTimeout(45_000);

        await page.goto(`/products/${setup.productId}`);

        // The Assets PageBlock in EntityAssets renders the featured asset
        // inside a `<div data-testid="entity-assets-featured">` wrapper. Target
        // its <img> directly so the test doesn't depend on the asset server's
        // URL scheme.
        const featuredImage = page.getByTestId('entity-assets-featured').locator('img');
        await expect(featuredImage).toBeVisible({ timeout: 15_000 });
        await featuredImage.click();

        // The preview dialog opens with the new "Set focal point" button.
        const setFocalPointTrigger = page.getByTestId('asset-preview-set-focal-point');
        await expect(setFocalPointTrigger).toBeVisible({ timeout: 5_000 });

        const focalPointValue = page.getByTestId('asset-preview-focal-point-value');
        // Activate the focal-point editor and confirm with the default centre
        // position the editor renders for an asset without a saved focal point.
        await setFocalPointTrigger.click();
        await page.getByTestId('asset-focal-point-editor-confirm').click();

        // After the mutation, the coords readout updates (the toast assertion
        // is skipped — sonner auto-dismisses too quickly to race against
        // reliably and the coords readout is the load-bearing signal).
        await expect(focalPointValue).toContainText('0.50, 0.50', { timeout: 10_000 });

        // Close the dialog (Escape) and re-open — the indicator must still
        // show the saved coords, not regress to the stale parent value.
        // Before the parent-sync fix, EntityAssets' local `assets` array would
        // still hold the pre-save focal point, so the re-opened dialog would
        // misreport "Not set" or stale coords.
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog')).toBeHidden({ timeout: 5_000 });

        await featuredImage.click();
        await expect(focalPointValue).toContainText('0.50, 0.50', { timeout: 5_000 });
    });
});
