import { ChannelCodeLabel } from '@/vdb/components/shared/channel-code-label.js';
import { MenuBranding } from '@/vdb/components/shared/powered-by-vendure.js';
import { Button } from '@/vdb/components/ui/button.js';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/vdb/components/ui/dropdown-menu.js';
import {
    NavigationMenu,
    NavigationMenuContent,
    NavigationMenuItem,
    NavigationMenuLink,
    NavigationMenuList,
    NavigationMenuTrigger,
} from '@/vdb/components/ui/navigation-menu.js';
import { ScrollArea } from '@/vdb/components/ui/scroll-area.js';
import { DEFAULT_CHANNEL_CODE } from '@/vdb/constants.js';
import { getLayoutConfig } from '@/vdb/framework/extension-api/logic/layout-config.js';
import { useDashboardExtensions } from '@/vdb/framework/extension-api/use-dashboard-extensions.js';
import {
    NavMenuItem as NavMenuItemType,
    NavMenuSection,
    NavMenuSectionPlacement,
} from '@/vdb/framework/nav-menu/nav-menu-extensions.js';
import { getNavMenuConfig } from '@/vdb/framework/nav-menu/nav-menu-extensions.js';
import { useAuth } from '@/vdb/hooks/use-auth.js';
import { useChannel } from '@/vdb/hooks/use-channel.js';
import { useDisplayLocale } from '@/vdb/hooks/use-display-locale.js';
import { useLocalFormat } from '@/vdb/hooks/use-local-format.js';
import { usePermissions } from '@/vdb/hooks/use-permissions.js';
import { useSortedLanguages } from '@/vdb/hooks/use-sorted-languages.js';
import { useUserSettings } from '@/vdb/hooks/use-user-settings.js';
import { cn } from '@/vdb/lib/utils.js';
import { Theme } from '@/vdb/providers/theme-provider.js';
import { useLingui } from '@lingui/react';
import { Trans } from '@lingui/react/macro';
import { Link, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import {
    ChevronsUpDown,
    Languages,
    LogOut,
    Monitor,
    Moon,
    Plus,
    Settings,
    Sparkles,
    Sun,
} from 'lucide-react';
import * as React from 'react';
import { Dialog, DialogTrigger } from '../ui/dialog.js';
import { LanguageDialog } from './language-dialog.js';
import { ManageLanguagesDialog } from './manage-languages-dialog.js';
import { PermissionGuard } from '../shared/permission-guard.js';

function sortByOrder<T extends { order?: number; title: string }>(a: T, b: T) {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
    if (orderA === orderB) {
        return a.title.localeCompare(b.title);
    }
    return orderA - orderB;
}

function escapeRegexChars(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getChannelInitialsFromCode(code: string) {
    const parts = code.split(/[-_]/);
    if (parts.length > 1) {
        return parts
            .filter(part => part.length > 0)
            .slice(0, 3)
            .map(part => part[0])
            .join('');
    } else {
        return code.slice(0, 3);
    }
}

/**
 * Compact channel switcher for the topbar that does not rely on SidebarProvider context.
 */
function TopbarChannelSwitcher() {
    const { channels, activeChannel, setActiveChannel } = useChannel();
    const { formatLanguageName } = useLocalFormat();
    const {
        settings: { contentLanguage },
        setContentLanguage,
    } = useUserSettings();
    const [showManageLanguagesDialog, setShowManageLanguagesDialog] = React.useState(false);
    const displayChannel = activeChannel;

    const orderedChannels = displayChannel ? channels.filter(ch => ch.id !== displayChannel.id) : channels;
    const sortedLanguages = useSortedLanguages(displayChannel?.availableLanguageCodes);

    React.useEffect(() => {
        if (activeChannel?.availableLanguageCodes) {
            if (!activeChannel.availableLanguageCodes.includes(contentLanguage as any)) {
                setContentLanguage(activeChannel.defaultLanguageCode);
            }
        }
    }, [activeChannel, contentLanguage]);

    const renderChannel = (channel: (typeof channels)[number]) => (
        <div key={channel.code}>
            <DropdownMenuItem onClick={() => setActiveChannel(channel.id)} className="gap-2 p-2">
                <div
                    className={cn(
                        'flex size-6 items-center justify-center rounded border',
                        channel.code === DEFAULT_CHANNEL_CODE ? 'bg-primary' : '',
                    )}
                >
                    <span className="truncate font-semibold text-[10px] uppercase">
                        {getChannelInitialsFromCode(channel.code)}
                    </span>
                </div>
                <ChannelCodeLabel code={channel.code} />
                {channel.id === displayChannel?.id && (
                    <span className="ms-auto text-xs text-muted-foreground">
                        <Trans context="current channel">Current</Trans>
                    </span>
                )}
            </DropdownMenuItem>
        </div>
    );

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 px-2"
                        />
                    }
                >
                    <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded">
                        <span className="truncate font-semibold text-[10px] uppercase">
                            {getChannelInitialsFromCode(displayChannel?.code || '')}
                        </span>
                    </div>
                    <span className="hidden truncate text-sm font-medium sm:inline">
                        <ChannelCodeLabel code={displayChannel?.code} />
                    </span>
                    <ChevronsUpDown className="size-3.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-64 rounded-lg pt-0 pr-0" align="start" sideOffset={8}>
                    <ScrollArea className="max-h-[calc(100vh_-_80px)] overflow-y-auto pr-1">
                        <div className="sticky top-0 pt-1 bg-popover z-10">
                            <DropdownMenuGroup>
                                <DropdownMenuLabel className="text-muted-foreground text-xs">
                                    <Trans>Channels</Trans>
                                </DropdownMenuLabel>
                            </DropdownMenuGroup>
                            {!!displayChannel && (
                                <>
                                    {renderChannel(displayChannel)}
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="gap-2 p-2 ps-4">
                                            <Languages className="w-4 h-4 shrink-0" />
                                            <div className="flex gap-1 ms-2">
                                                <span className="text-muted-foreground shrink-0">
                                                    <Trans>Content:</Trans>
                                                </span>
                                                <span className="truncate">
                                                    {formatLanguageName(contentLanguage)}
                                                </span>
                                            </div>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                            {sortedLanguages?.map(({ code: languageCode, label }) => (
                                                <DropdownMenuItem
                                                    key={`${displayChannel.code}-${languageCode}`}
                                                    onClick={() => setContentLanguage(languageCode)}
                                                    className={`gap-2 p-2 ${contentLanguage === languageCode ? 'bg-accent' : ''}`}
                                                >
                                                    <div className="flex w-fit min-w-9 px-1.5 h-5 items-center justify-center rounded border shrink-0">
                                                        <span className="font-medium text-xs">
                                                            {languageCode.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span className="truncate flex-1">{label}</span>
                                                    {contentLanguage === languageCode && (
                                                        <span className="ms-auto text-xs text-muted-foreground shrink-0">
                                                            <Trans context="active language">Active</Trans>
                                                        </span>
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => setShowManageLanguagesDialog(true)}
                                                className="gap-2 p-2"
                                            >
                                                <Languages className="w-4 h-4" />
                                                <span>
                                                    <Trans>Manage Languages</Trans>
                                                </span>
                                            </DropdownMenuItem>
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
                                    {orderedChannels.length > 0 && <DropdownMenuSeparator />}
                                </>
                            )}
                        </div>
                        {orderedChannels.map(renderChannel)}
                        <PermissionGuard requires={['CreateChannel']}>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="gap-2 p-2 cursor-pointer"
                                render={<Link to={'/channels/new'} />}
                            >
                                <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                                    <Plus className="size-4" />
                                </div>
                                <div className="text-muted-foreground font-medium">
                                    <Trans>Add channel</Trans>
                                </div>
                            </DropdownMenuItem>
                        </PermissionGuard>
                    </ScrollArea>
                </DropdownMenuContent>
            </DropdownMenu>
            <ManageLanguagesDialog
                open={showManageLanguagesDialog}
                onClose={() => setShowManageLanguagesDialog(false)}
            />
        </>
    );
}

/**
 * Compact user menu for the topbar that does not rely on SidebarProvider context.
 */
function TopbarUserMenu() {
    const router = useRouter();
    const navigate = useNavigate();
    const { humanReadableLanguage } = useDisplayLocale();
    const { user, ...auth } = useAuth();
    const { settings, setTheme, setDevMode } = useUserSettings();

    const handleLogout = () => {
        auth.logout().then(() => {
            router.invalidate().finally(() => {
                navigate({ to: '/login' });
            });
        });
    };

    const avatarFallback = React.useMemo(() => {
        return (user?.firstName?.charAt(0) ?? '') + (user?.lastName?.charAt(0) ?? '');
    }, [user]);

    if (!user) {
        return null;
    }

    const isDevMode = (import.meta as any).env?.MODE === 'development';

    return (
        <Dialog>
            <DropdownMenu>
                <DropdownMenuTrigger
                    render={
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2 px-2"
                        />
                    }
                >
                    <div className="relative flex rounded-lg border justify-center items-center w-7 h-7 text-xs">
                        {avatarFallback}
                    </div>
                    <span className="hidden truncate text-sm font-medium sm:inline">
                        {user.firstName} {user.lastName}
                    </span>
                    <ChevronsUpDown className="size-3.5 opacity-50" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-56 rounded-lg" align="end" sideOffset={8}>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <div className="relative flex rounded-lg border justify-center items-center w-8 h-8">
                                    {avatarFallback}
                                </div>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-heading font-semibold text-accent-foreground">
                                        {user.firstName} {user.lastName}
                                    </span>
                                    <span className="truncate font-mono text-xs">{user.emailAddress}</span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            render={
                                <a
                                    href="https://vendure.io/pricing"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label="Explore Platform & Cloud"
                                />
                            }
                        >
                            <Sparkles />
                            <Trans>Explore Platform & Cloud</Trans>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                        <DropdownMenuItem render={<Link to="/profile" />}>
                            <Trans>Profile</Trans>
                        </DropdownMenuItem>
                        <DialogTrigger
                            nativeButton={false}
                            render={<DropdownMenuItem className="flex gap-2" />}
                        >
                            <div>
                                <Trans>Language</Trans>
                            </div>
                            <div className="text-muted-foreground">{humanReadableLanguage}</div>
                        </DialogTrigger>
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Trans>Theme</Trans>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup
                                    value={settings.theme}
                                    onValueChange={value => setTheme(value as Theme)}
                                >
                                    <DropdownMenuRadioItem value="light">
                                        <Sun />
                                        <Trans context="theme">Light</Trans>
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="dark">
                                        <Moon />
                                        <Trans context="theme">Dark</Trans>
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="system">
                                        <Monitor />
                                        <Trans context="theme">System</Trans>
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    </DropdownMenuGroup>
                    {isDevMode && (
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                                <Trans>Dev Mode</Trans>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup
                                    value={settings.devMode.toString()}
                                    onValueChange={value => setDevMode(value === 'true')}
                                >
                                    <DropdownMenuRadioItem value="true">
                                        <Trans>Enabled</Trans>
                                    </DropdownMenuRadioItem>
                                    <DropdownMenuRadioItem value="false">
                                        <Trans>Disabled</Trans>
                                    </DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                            </DropdownMenuSubContent>
                        </DropdownMenuSub>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                        <LogOut />
                        <Trans>Log out</Trans>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <MenuBranding />
                </DropdownMenuContent>
            </DropdownMenu>
            <LanguageDialog />
        </Dialog>
    );
}

function TopbarNavContent({
    showLabels,
    autoCollapse,
    adminGrouping,
}: {
    showLabels: boolean;
    autoCollapse: boolean;
    adminGrouping: 'grouped' | 'inline';
}) {
    const { i18n } = useLingui();
    const { hasPermissions } = usePermissions();
    const router = useRouter();
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;
    const basePath = router.basepath || '';

    const { sections } = getNavMenuConfig();

    const labelClass = cn(
        showLabels ? 'inline' : 'hidden',
        autoCollapse && showLabels && 'lg:inline hidden',
    );

    const isPathActive = React.useCallback(
        (itemUrl: string) => {
            const normalizedCurrentPath = basePath
                ? currentPath.replace(new RegExp(`^${escapeRegexChars(basePath)}`), '')
                : currentPath;

            const cleanPath = normalizedCurrentPath.startsWith('/')
                ? normalizedCurrentPath
                : `/${normalizedCurrentPath}`;

            if (itemUrl === '/') {
                return cleanPath === '/' || cleanPath === '';
            }

            return cleanPath === itemUrl || cleanPath.startsWith(`${itemUrl}/`);
        },
        [currentPath, basePath],
    );

    const isItemAllowed = React.useCallback(
        (item: NavMenuItemType) => {
            if (!item.requiresPermission) {
                return true;
            }
            const permissions = Array.isArray(item.requiresPermission)
                ? item.requiresPermission
                : [item.requiresPermission];
            return hasPermissions(permissions);
        },
        [hasPermissions],
    );

    const getSortedSections = React.useCallback(
        (placement: NavMenuSectionPlacement) => {
            return sections
                .filter(item => item.placement === placement)
                .slice()
                .sort(sortByOrder)
                .map(section => {
                    if ('items' in section) {
                        const allowedItems = (section.items ?? []).filter(isItemAllowed).sort(sortByOrder);
                        return { ...section, items: allowedItems };
                    }
                    return section;
                })
                .filter(section => {
                    if ('items' in section) {
                        return section.items && section.items.length > 0;
                    }
                    return isItemAllowed(section as NavMenuItemType);
                });
        },
        [sections, isItemAllowed],
    );

    const topSections = React.useMemo(() => getSortedSections('top'), [getSortedSections]);
    const bottomSections = React.useMemo(() => getSortedSections('bottom'), [getSortedSections]);

    const renderNavItem = (item: NavMenuSection | NavMenuItemType) => {
        if ('url' in item) {
            return (
                <NavigationMenuItem key={item.id}>
                    <NavigationMenuLink
                        render={<Link to={item.url} />}
                        className={cn(
                            'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                            isPathActive(item.url) && 'bg-muted',
                        )}
                    >
                        {item.icon && <item.icon className="size-4" />}
                        <span className={labelClass}>{i18n.t(item.title)}</span>
                    </NavigationMenuLink>
                </NavigationMenuItem>
            );
        }

        const hasActiveChild = item.items?.some(sub => isPathActive(sub.url));

        return (
            <NavigationMenuItem key={item.id}>
                <NavigationMenuTrigger
                    className={cn('flex items-center gap-1.5', hasActiveChild && 'bg-muted/50')}
                >
                    {item.icon && <item.icon className="size-4" />}
                    <span className={labelClass}>{i18n.t(item.title)}</span>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                    <ul className="grid w-[240px] gap-1 p-2">
                        {item.items?.map(subItem => (
                            <li key={subItem.id}>
                                <NavigationMenuLink
                                    render={<Link to={subItem.url} />}
                                    className={cn(
                                        'block rounded-md px-3 py-2 text-sm transition-colors',
                                        isPathActive(subItem.url)
                                            ? 'bg-muted font-medium'
                                            : 'hover:bg-muted',
                                    )}
                                >
                                    {i18n.t(subItem.title)}
                                </NavigationMenuLink>
                            </li>
                        ))}
                    </ul>
                </NavigationMenuContent>
            </NavigationMenuItem>
        );
    };

    const renderAdminGrouped = () => {
        if (bottomSections.length === 0) {
            return null;
        }

        const hasActiveBottomChild = bottomSections.some(section => {
            if ('items' in section) {
                return section.items?.some(sub => isPathActive(sub.url));
            }
            if ('url' in section) {
                return isPathActive(section.url);
            }
            return false;
        });

        return (
            <NavigationMenuItem>
                <NavigationMenuTrigger
                    className={cn('flex items-center gap-1.5', hasActiveBottomChild && 'bg-muted/50')}
                >
                    <Settings className="size-4" />
                    <span className={labelClass}>
                        <Trans>Administration</Trans>
                    </span>
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                    <div className="w-[280px] p-2">
                        {bottomSections.map((section, idx) => {
                            if ('url' in section) {
                                return (
                                    <NavigationMenuLink
                                        key={section.id}
                                        render={<Link to={section.url} />}
                                        className={cn(
                                            'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors',
                                            isPathActive(section.url) ? 'bg-muted font-medium' : 'hover:bg-muted',
                                        )}
                                    >
                                        {section.icon && <section.icon className="size-4" />}
                                        <span>{i18n.t(section.title)}</span>
                                    </NavigationMenuLink>
                                );
                            }
                            return (
                                <div key={section.id}>
                                    {idx > 0 && <div className="bg-border my-1 h-px" />}
                                    <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                                        {i18n.t(section.title)}
                                    </p>
                                    <ul className="grid gap-0.5">
                                        {section.items?.map(subItem => (
                                            <li key={subItem.id}>
                                                <NavigationMenuLink
                                                    render={<Link to={subItem.url} />}
                                                    className={cn(
                                                        'block rounded-md px-3 py-2 text-sm transition-colors',
                                                        isPathActive(subItem.url)
                                                            ? 'bg-muted font-medium'
                                                            : 'hover:bg-muted',
                                                    )}
                                                >
                                                    {i18n.t(subItem.title)}
                                                </NavigationMenuLink>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </NavigationMenuContent>
            </NavigationMenuItem>
        );
    };

    return (
        <NavigationMenu>
            <NavigationMenuList>
                {topSections.map(renderNavItem)}
                {adminGrouping === 'grouped'
                    ? renderAdminGrouped()
                    : bottomSections.map(renderNavItem)}
            </NavigationMenuList>
        </NavigationMenu>
    );
}

export function AppTopbar() {
    const { extensionsLoaded } = useDashboardExtensions();
    const { topbar: topbarConfig } = getLayoutConfig();

    const sticky = topbarConfig?.sticky ?? true;
    const height = topbarConfig?.height ?? 'default';
    const showLabels = topbarConfig?.showLabels ?? true;
    const adminGrouping = topbarConfig?.adminGrouping ?? 'grouped';
    const autoCollapse = topbarConfig?.autoCollapse ?? true;

    if (!extensionsLoaded) {
        return null;
    }

    return (
        <header
            className={cn(
                'bg-background z-50 flex items-center gap-2 border-b px-4',
                sticky && 'sticky top-0',
                height === 'compact' ? 'h-10' : 'h-14',
            )}
        >
            <TopbarChannelSwitcher />
            <nav className="flex-1 overflow-x-auto">
                <TopbarNavContent
                    showLabels={showLabels}
                    autoCollapse={autoCollapse}
                    adminGrouping={adminGrouping}
                />
            </nav>
            <TopbarUserMenu />
        </header>
    );
}
