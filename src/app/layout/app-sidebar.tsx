import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { Activity, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermission } from '@/features/auth/use-session';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/shared/ui/sidebar';
import { CompanySwitcher } from './company-switcher';
import { filterNavigation, findActiveNavTarget, NAVIGATION } from './navigation';

export function AppSidebar() {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const { isMobile, setOpen, setOpenMobile } = useSidebar();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const activeTo = findActiveNavTarget(pathname);
  const isActive = (to: string) => to === activeTo;

  const groups = useMemo(() => {
    const allowed = NAVIGATION.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permission || can(item.permission)),
    })).filter((group) => group.items.length);
    return filterNavigation(allowed, query, (key) => t(key as never));
  }, [can, query, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      if (isMobile) setOpenMobile(true);
      else setOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, setOpen, setOpenMobile]);

  const openFirstMatch = () => {
    const first = groups.flatMap((group) => group.items).find((item) => item.to);
    if (!first?.to) return;
    setQuery('');
    void navigate({ to: first.to });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Activity className="size-4" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">{t('app.name')}</span>
                  <span className="text-muted-foreground truncate text-xs">{t('app.tagline')}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="relative group-data-[collapsible=icon]:hidden">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <SidebarInput
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') openFirstMatch();
              if (event.key === 'Escape') setQuery('');
            }}
            placeholder={t('nav.search')}
            aria-label={t('nav.search')}
            className="pr-8 pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                searchRef.current?.focus();
              }}
              aria-label={t('nav.clearSearch')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {query && !groups.length && (
          <p className="text-muted-foreground px-4 py-6 text-center text-sm">
            {t('nav.noResults')}
          </p>
        )}
        {groups.map((group) => {
          const items = group.items;
          return (
            <SidebarGroup key={group.labelKey}>
              <SidebarGroupLabel>{t(group.labelKey as never)}</SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) => (
                  <SidebarMenuItem key={item.labelKey}>
                    {item.to ? (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive(item.to)}
                        tooltip={t(item.labelKey as never)}
                      >
                        <Link to={item.to} onClick={() => setQuery('')}>
                          <item.icon />
                          <span>{t(item.labelKey as never)}</span>
                        </Link>
                      </SidebarMenuButton>
                    ) : (
                      <>
                        <SidebarMenuButton
                          disabled
                          className="opacity-60"
                          tooltip={t(item.labelKey as never)}
                        >
                          <item.icon />
                          <span>{t(item.labelKey as never)}</span>
                        </SidebarMenuButton>
                        {item.comingSoon && (
                          <SidebarMenuBadge className="text-[10px] font-normal">
                            {t('nav.comingSoon')}
                          </SidebarMenuBadge>
                        )}
                      </>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <CompanySwitcher />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
