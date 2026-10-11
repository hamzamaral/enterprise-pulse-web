import {
  Boxes,
  BriefcaseBusiness,
  Building,
  Building2,
  CalendarCheck,
  CalendarCog,
  CalendarDays,
  ClipboardCheck,
  FileClock,
  GitBranch,
  Inbox,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Network,
  PackageCheck,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  Workflow,
} from 'lucide-react';
import type { FileRoutesByTo } from '@/routeTree.gen';

export interface NavItem {
  to?: keyof FileRoutesByTo;
  labelKey: string;
  icon: LucideIcon;
  permission?: string;
  /** Roadmap modules that are not implemented yet. */
  comingSoon?: boolean;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export const NAVIGATION: NavGroup[] = [
  {
    labelKey: 'nav.groups.general',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
      { to: '/workflow/inbox', labelKey: 'nav.inbox', icon: Inbox },
    ],
  },
  {
    labelKey: 'nav.groups.hr',
    items: [
      { to: '/hr/my-leave', labelKey: 'nav.myLeave', icon: CalendarDays },
      { to: '/hr/org-chart', labelKey: 'nav.orgChart', icon: Network },
      {
        to: '/hr/employees',
        labelKey: 'nav.employees',
        icon: UsersRound,
        permission: 'employees:read',
      },
      {
        to: '/hr/departments',
        labelKey: 'nav.departments',
        icon: Building,
        permission: 'departments:read',
      },
      {
        to: '/hr/positions',
        labelKey: 'nav.positions',
        icon: BriefcaseBusiness,
        permission: 'positions:read',
      },
      {
        to: '/hr/leave-requests',
        labelKey: 'nav.leaveRequests',
        icon: CalendarCheck,
        permission: 'leave:read',
      },
      {
        to: '/hr/leave-settings',
        labelKey: 'nav.leaveSettings',
        icon: CalendarCog,
        permission: 'leave:update',
      },
    ],
  },
  {
    labelKey: 'nav.groups.modules',
    items: [
      { labelKey: 'nav.assets', icon: PackageCheck, comingSoon: true },
      { labelKey: 'nav.inventory', icon: Boxes, comingSoon: true },
      { labelKey: 'nav.purchasing', icon: ShoppingCart, comingSoon: true },
      { labelKey: 'nav.sales', icon: TrendingUp, comingSoon: true },
      { labelKey: 'nav.finance', icon: Wallet, comingSoon: true },
    ],
  },
  {
    labelKey: 'nav.groups.workflow',
    items: [
      {
        to: '/workflow/instances',
        labelKey: 'nav.instances',
        icon: ClipboardCheck,
        permission: 'workflow:read',
      },
      {
        to: '/workflow/definitions',
        labelKey: 'nav.definitions',
        icon: Workflow,
        permission: 'workflow:read',
      },
    ],
  },
  {
    labelKey: 'nav.groups.organization',
    items: [
      {
        to: '/companies',
        labelKey: 'nav.companies',
        icon: Building2,
        permission: 'companies:read',
      },
      { to: '/branches', labelKey: 'nav.branches', icon: MapPin, permission: 'branches:read' },
      { to: '/users', labelKey: 'nav.users', icon: Users, permission: 'users:read' },
      { to: '/roles', labelKey: 'nav.roles', icon: ShieldCheck, permission: 'roles:read' },
    ],
  },
  {
    labelKey: 'nav.groups.system',
    items: [
      { to: '/audit-logs', labelKey: 'nav.audit', icon: FileClock, permission: 'audit:read' },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings:read' },
    ],
  },
];

export const APP_ICON = GitBranch;
