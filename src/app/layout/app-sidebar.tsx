import { Link, useRouterState } from '@tanstack/react-router';
import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePermission } from '@/features/auth/use-session';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/shared/ui/sidebar';
import { CompanySwitcher } from './company-switcher';
import { NAVIGATION } from './navigation';

export function AppSidebar() {
  const { t } = useTranslation();
  const can = usePermission();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

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
      </SidebarHeader>

      <SidebarContent>
        {NAVIGATION.map((group) => {
          const items = group.items.filter((item) => !item.permission || can(item.permission));
          if (!items.length) return null;
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
                        <Link to={item.to}>
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
