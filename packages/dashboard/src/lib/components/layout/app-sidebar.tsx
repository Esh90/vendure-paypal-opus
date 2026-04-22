import { NavMain } from '@/vdb/components/layout/nav-main.js';
import { NavUser } from '@/vdb/components/layout/nav-user.js';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarRail,
} from '@/vdb/components/ui/sidebar.js';
import { getLayoutConfig } from '@/vdb/framework/extension-api/logic/layout-config.js';
import { useDashboardExtensions } from '@/vdb/framework/extension-api/use-dashboard-extensions.js';
import { getNavMenuConfig } from '@/vdb/framework/nav-menu/nav-menu-extensions.js';
import { useDisplayLocale } from '@/vdb/hooks/use-display-locale.js';
import * as React from 'react';
import { ChannelSwitcher } from './channel-switcher.js';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const { extensionsLoaded } = useDashboardExtensions();
    const { isRTL } = useDisplayLocale();
    const { sections } = getNavMenuConfig();
    const { sidebar: sidebarConfig } = getLayoutConfig();

    const side = sidebarConfig?.side ?? (isRTL ? 'right' : 'left');
    const variant = sidebarConfig?.variant ?? 'sidebar';
    const collapsible = sidebarConfig?.collapsible ?? 'icon';

    return (
        extensionsLoaded && (
            <Sidebar collapsible={collapsible} variant={variant} {...props} side={side}>
                <SidebarHeader>
                    <ChannelSwitcher />
                </SidebarHeader>
                <SidebarContent>
                    <NavMain items={sections} />
                </SidebarContent>
                <SidebarFooter>
                    <NavUser />
                </SidebarFooter>
                {collapsible !== 'none' && <SidebarRail />}
            </Sidebar>
        )
    );
}
