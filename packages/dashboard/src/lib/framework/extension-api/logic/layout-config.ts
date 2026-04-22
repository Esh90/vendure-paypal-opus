import { globalRegistry } from '../../registry/global-registry.js';
import {
    DashboardLayoutConfig,
    DashboardSidebarConfig,
    DashboardTopbarConfig,
} from '../types/layout-config.js';

const SIDEBAR_CONFIG_KEYS: Array<keyof DashboardSidebarConfig> = ['variant', 'collapsible', 'defaultOpen'];

const TOPBAR_CONFIG_KEYS: Array<keyof DashboardTopbarConfig> = [
    'sticky',
    'height',
    'showLabels',
    'adminGrouping',
    'autoCollapse',
];

/**
 * Registers layout configuration from an extension. Shallow-merges navigationStyle,
 * sidebar, and topbar properties into the global registry. When multiple extensions
 * set the same property, the last one wins and a warning is logged.
 */
export function registerLayoutConfigExtensions(config: DashboardLayoutConfig | undefined) {
    if (!config) {
        return;
    }
    globalRegistry.set('dashboardLayoutConfig', existing => {
        const merged = { ...existing };
        if (config.navigationStyle !== undefined) {
            if (existing.navigationStyle !== undefined) {
                // eslint-disable-next-line no-console
                console.warn(
                    `[Vendure Dashboard] Multiple extensions are setting layout.navigationStyle. ` +
                        `The value "${config.navigationStyle}" will override "${existing.navigationStyle}".`,
                );
            }
            merged.navigationStyle = config.navigationStyle;
        }
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
        if (config.topbar) {
            const existingTopbar = merged.topbar ?? {};
            const mergedTopbar = { ...existingTopbar };
            for (const key of TOPBAR_CONFIG_KEYS) {
                if (config.topbar[key] !== undefined) {
                    if (existingTopbar[key] !== undefined) {
                        // eslint-disable-next-line no-console
                        console.warn(
                            `[Vendure Dashboard] Multiple extensions are setting layout.topbar.${key}. ` +
                                `The value "${String(config.topbar[key])}" will override "${String(existingTopbar[key])}".`,
                        );
                    }
                    (mergedTopbar as Record<string, unknown>)[key] = config.topbar[key];
                }
            }
            merged.topbar = mergedTopbar;
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
