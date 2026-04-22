/**
 * @description
 * Configuration options for the dashboard sidebar appearance and behavior.
 * These map directly to the props accepted by the underlying `Sidebar` primitive
 * from `@vendure-io/ui`.
 *
 * Note: The sidebar's side (left or right) is automatically determined by the
 * current locale's text direction (RTL/LTR) and cannot be configured.
 *
 * @docsCategory extensions-api
 * @docsPage Layout Config
 * @since 3.6.3
 */
export interface DashboardSidebarConfig {
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
 * Configuration options for the dashboard topbar appearance and behavior.
 * Only applies when `navigationStyle` is `'topbar'`.
 *
 * @docsCategory extensions-api
 * @docsPage Layout Config
 * @since 3.6.3
 */
export interface DashboardTopbarConfig {
    /**
     * @description
     * Whether the topbar sticks to the top of the viewport on scroll.
     *
     * @default true
     */
    sticky?: boolean;
    /**
     * @description
     * The height of the topbar.
     *
     * - `'default'` — standard height (h-14)
     * - `'compact'` — reduced height (h-10)
     *
     * @default 'default'
     */
    height?: 'compact' | 'default';
    /**
     * @description
     * Whether to show text labels alongside icons in the navigation items.
     * When false, only icons are displayed.
     *
     * @default true
     */
    showLabels?: boolean;
    /**
     * @description
     * How bottom-placement nav sections (e.g. Administration) are rendered.
     *
     * - `'grouped'` — collapsed into a single "Administration" dropdown (default)
     * - `'inline'` — rendered flat alongside the top-placement sections
     *
     * @default 'grouped'
     */
    adminGrouping?: 'grouped' | 'inline';
    /**
     * @description
     * When true, text labels are automatically hidden on narrow viewports
     * (below the `lg` breakpoint), showing icon-only navigation items.
     * When false, labels are always shown regardless of viewport width.
     *
     * @default true
     */
    autoCollapse?: boolean;
}

/**
 * @description
 * Declarative configuration for the overall dashboard layout.
 * Supports customization of the navigation style (sidebar or topbar),
 * sidebar appearance and behavior, and topbar appearance and behavior.
 *
 * @example
 * ```ts
 * import { defineDashboardExtension } from '\@vendure/dashboard';
 *
 * // Sidebar mode with customization
 * defineDashboardExtension({
 *     layout: {
 *         sidebar: {
 *             variant: 'floating',
 *             collapsible: 'offcanvas',
 *             defaultOpen: false,
 *         },
 *     },
 * });
 *
 * // Topbar mode with customization
 * defineDashboardExtension({
 *     layout: {
 *         navigationStyle: 'topbar',
 *         topbar: {
 *             sticky: true,
 *             height: 'compact',
 *             showLabels: true,
 *             adminGrouping: 'grouped',
 *             autoCollapse: true,
 *         },
 *     },
 * });
 * ```
 *
 * @docsCategory extensions-api
 * @docsPage Layout Config
 * @docsWeight 0
 * @since 3.6.3
 */
export interface DashboardLayoutConfig {
    /**
     * @description
     * Controls the overall navigation style of the dashboard.
     *
     * - `'sidebar'` — vertical sidebar navigation (left side by default, right side for RTL locales)
     * - `'topbar'` — horizontal navigation bar at the top of the viewport
     *
     * When set to `'topbar'`, the `sidebar` configuration options are ignored
     * and `topbar` configuration options apply instead. On mobile viewports,
     * the standard sidebar layout is always used regardless of this setting.
     *
     * @default 'sidebar'
     */
    navigationStyle?: 'sidebar' | 'topbar';
    /**
     * @description
     * Configuration for the sidebar appearance and behavior.
     * Only applies when `navigationStyle` is `'sidebar'` (or unset).
     */
    sidebar?: DashboardSidebarConfig;
    /**
     * @description
     * Configuration for the topbar appearance and behavior.
     * Only applies when `navigationStyle` is `'topbar'`.
     */
    topbar?: DashboardTopbarConfig;
}
