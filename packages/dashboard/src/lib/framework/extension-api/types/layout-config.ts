/**
 * @description
 * Configuration options for the dashboard sidebar appearance and behavior.
 * These map directly to the props accepted by the underlying `Sidebar` primitive
 * from `@vendure-io/ui`.
 *
 * @docsCategory extensions-api
 * @docsPage Layout Config
 * @since 3.7.0
 */
export interface DashboardSidebarConfig {
    /**
     * @description
     * Which side of the viewport the sidebar appears on.
     *
     * If not set, the sidebar defaults to `'left'` (or `'right'` for RTL locales).
     *
     * @default 'left'
     */
    side?: 'left' | 'right';
    /**
     * @description
     * The visual variant of the sidebar.
     *
     * - `'sidebar'` — fixed sidebar flush with the viewport edge (default)
     * - `'floating'` — sidebar with padding and rounded corners
     * - `'inset'` — sidebar inset into the main content area
     *
     * @default 'sidebar'
     */
    variant?: 'sidebar' | 'floating' | 'inset';
    /**
     * @description
     * How the sidebar collapses on desktop.
     *
     * - `'icon'` — collapses to a narrow icon rail (default)
     * - `'offcanvas'` — slides completely off-screen
     * - `'none'` — sidebar cannot be collapsed
     *
     * @default 'icon'
     */
    collapsible?: 'offcanvas' | 'icon' | 'none';
    /**
     * @description
     * Whether the sidebar is expanded by default on first load.
     *
     * @default true
     */
    defaultOpen?: boolean;
}

/**
 * @description
 * Declarative configuration for the overall dashboard layout.
 * Currently supports sidebar customization; additional layout
 * areas may be added in future versions.
 *
 * @example
 * ```ts
 * import { defineDashboardExtension } from '\@vendure/dashboard';
 *
 * defineDashboardExtension({
 *     layout: {
 *         sidebar: {
 *             side: 'right',
 *             variant: 'floating',
 *             collapsible: 'offcanvas',
 *             defaultOpen: false,
 *         },
 *     },
 * });
 * ```
 *
 * @docsCategory extensions-api
 * @docsPage Layout Config
 * @docsWeight 0
 * @since 3.7.0
 */
export interface DashboardLayoutConfig {
    /**
     * @description
     * Configuration for the sidebar appearance and behavior.
     */
    sidebar?: DashboardSidebarConfig;
}
