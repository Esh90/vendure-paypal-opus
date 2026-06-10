import * as React from 'react';

import { cn } from '@/vdb/lib/utils.js';

const badgeVariants = cva(
    'inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-auto',
    {
        variants: {
            variant: {
                default: 'border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90',
                secondary:
                    'border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90',
                destructive:
                    'border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
                outline: 'text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground',
                success: 'border-transparent bg-success text-success-foreground [a&]:hover:bg-success/90',
                warning: 'border-transparent bg-warning text-warning-foreground [a&]:hover:bg-warning/90',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;

export type BadgeProps = Omit<BaseBadgeProps, 'variant'> & {
    variant?: BaseBadgeProps['variant'] | 'success' | 'warning';
};

const customVariantStyles: Record<string, string> = {
    success: 'bg-success/10 text-success dark:bg-success/20 [a]:hover:bg-success/20',
    warning: 'bg-warning/10 text-warning dark:bg-warning/20 [a]:hover:bg-warning/20',
};

/**
 * Wrapper around @vendure-io/ui Badge that adds the "success" and "warning"
 * variants which are used in the dashboard but not available in the base library.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
    const custom = variant && customVariantStyles[variant];
    if (custom) {
        return <BaseBadge className={cn(custom, className)} {...props} />;
    }
    return <BaseBadge className={className} variant={variant as BaseBadgeProps['variant']} {...props} />;
}

export { Badge };
export { badgeVariants } from '@vendure-io/ui/components/ui/badge';
