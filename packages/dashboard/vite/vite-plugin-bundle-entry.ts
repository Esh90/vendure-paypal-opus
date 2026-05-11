import { Plugin } from 'vite';

/**
 * @description
 * Rewrites the dashboard's `index.html` script entry from the TypeScript source
 * (`/src/app/main.jsx`) to the pre-built ESM bundle
 * (`/dist/publishable/main.js`) and injects the compiled CSS link.
 *
 * Active only when `useExperimentalBundle` is enabled on
 * {@link vendureDashboardPlugin}. The bundle is generated at publish time by
 * `vite.lib.config.mts` and shipped inside the npm package.
 */
export function bundleEntryPlugin(): Plugin {
    return {
        name: 'vendure:bundle-entry',
        transformIndexHtml: {
            order: 'pre',
            handler(html, ctx) {
                // Don't transform Storybook HTML or anything else outside the dashboard's own entry
                if (
                    ctx.filename &&
                    (ctx.filename.includes('iframe.html') ||
                        ctx.filename.includes('storybook'))
                ) {
                    return html;
                }

                const cssLink = `<link rel="stylesheet" href="/dist/publishable/dashboard.css" />`;
                const newScript = `<script type="module" src="/dist/publishable/main.js"></script>`;

                // Match the source-entry script regardless of whether Vite has
                // already prepended the configured `base` to the src attribute.
                const replacedHtml = html.replace(
                    /<script\s+type="module"\s+src="[^"]*src\/app\/main\.jsx"\s*><\/script>/,
                    `${cssLink}\n${newScript}`,
                );

                return replacedHtml;
            },
        },
    };
}
