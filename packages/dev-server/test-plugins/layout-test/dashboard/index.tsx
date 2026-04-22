import { defineDashboardExtension } from '@vendure/dashboard';

defineDashboardExtension({
    layout: {
        sidebar: {
            variant: 'inset',
            collapsible: 'offcanvas',
            defaultOpen: true,
        },
    },
});
