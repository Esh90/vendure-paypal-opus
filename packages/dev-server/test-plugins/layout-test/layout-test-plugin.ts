import { VendurePlugin } from '@vendure/core';

/**
 * A test plugin that demonstrates the layout extension point by customizing
 * the sidebar appearance: floating variant with offcanvas collapsing,
 * starting collapsed by default.
 */
@VendurePlugin({
    dashboard: './dashboard/index.tsx',
})
export class LayoutTestPlugin {}
