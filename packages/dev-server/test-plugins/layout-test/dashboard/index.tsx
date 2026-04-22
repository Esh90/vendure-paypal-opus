import { defineDashboardExtension } from '@vendure/dashboard';

defineDashboardExtension({
    layout: {
        navigationStyle: 'sidebar',
        topbar: {
            sticky: true,
            height: 'default',
            showLabels: true,
            adminGrouping: 'grouped',
            autoCollapse: true,
        },
        sidebar: {
            variant: 'sidebar',
            collapsible: 'icon',
            defaultOpen: true,

        },
    },
});
