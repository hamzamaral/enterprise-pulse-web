import { Building2, Check, ChevronsUpDown, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMe, useSwitchContext } from '@/features/auth/use-session';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/shared/ui/sidebar';

export function CompanySwitcher() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { switchCompany, switchBranch } = useSwitchContext();
  if (!me) return null;

  const company = me.companies.find((c) => c.id === me.activeCompanyId);
  const branch = company?.branches.find((b) => b.id === me.activeBranchId);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" data-testid="company-switcher">
              <div className="bg-sidebar-accent flex aspect-square size-8 items-center justify-center rounded-lg">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{company?.name}</span>
                <span className="text-muted-foreground truncate text-xs">
                  {branch?.name ?? t('layout.allBranches')}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel>{t('layout.company')}</DropdownMenuLabel>
            {me.companies.map((c) => (
              <DropdownMenuItem key={c.id} onSelect={() => void switchCompany(c.id)}>
                <Building2 />
                <span className="flex-1 truncate">{c.name}</span>
                {c.id === me.activeCompanyId && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
            {company && company.branches.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>{t('layout.branch')}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => void switchBranch(null)}>
                  <MapPin />
                  <span className="flex-1">{t('layout.allBranches')}</span>
                  {!me.activeBranchId && <Check className="size-4" />}
                </DropdownMenuItem>
                {company.branches.map((b) => (
                  <DropdownMenuItem key={b.id} onSelect={() => void switchBranch(b.id)}>
                    <MapPin />
                    <span className="flex-1 truncate">{b.name}</span>
                    {b.id === me.activeBranchId && <Check className="size-4" />}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
