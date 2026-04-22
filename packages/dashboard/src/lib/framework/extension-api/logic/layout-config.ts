import { globalRegistry } from '../../registry/global-registry.js';
import { DashboardLayoutConfig, DashboardSidebarConfig } from '../types/layout-config.js';

const SIDEBAR_CONFIG_KEYS: Array<keyof DashboardSidebarConfig> = [
    'side',
    'variant',
    'collapsible',
    'defaultOpen',
];

/**
 * Registers layout configuration from an extension. Shallow-merges sidebar
 * properties into the global registry. When multiple extensions set the same
 * sidebar property, the last one wins and a warning is logged.
 */
export function registerLayoutConfigExtensions(config: DashboardLayoutConfig | undefined) {
    if (!config) {
        return;
    }
    globalRegistry.set('dashboardLayoutConfig', existing => {
        const merged = { ...existing };
        if (config.sidebar) {
            const existingSidebar = merged.sidebar ?? {};
            const mergedSidebar = { ...existingSidebar };
            for (const key of SIDEBAR_CONFIG_KEYS) {
                if (config.sidebar[key] !== undefined) {
                    if (existingSidebar[key] !== undefined) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `[Vendure Dashboard] Multiple extensions are setting layout.sidebar.${key}. ` +
                                `The value "${String(config.sidebar[key])}" will override "${String(existingSidebar[key])}".`,
                        );
                    }
                    (mergedSidebar as Record<string, unknown>)[key] = config.sidebar[key];
                }
            }
            merged.sidebar = mergedSidebar;
        }
        return merged;
    });
}

/**
 * Returns the current resolved layout configuration from the global registry.
 */
export function getLayoutConfig(): DashboardLayoutConfig {
    return globalRegistry.get('dashboardLayoutConfig');
}
