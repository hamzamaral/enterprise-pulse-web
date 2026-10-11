import {
  ArrowDownUp,
  ArrowLeftRight,
  Boxes,
  BriefcaseBusiness,
  Building,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarCog,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock,
  Contact,
  FileSpreadsheet,
  FileText,
  FileClock,
  GitBranch,
  Inbox,
  Laptop,
  LayoutDashboard,
  type LucideIcon,
  MapPin,
  Network,
  Package,
  PackageCheck,
  PackageOpen,
  ScanQrCode,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  TrendingUp,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  Workflow,
} from 'lucide-react';
import type { FileRoutesByTo } from '@/routeTree.gen';

export interface NavItem {
  to?: keyof FileRoutesByTo;
  labelKey: string;
  icon: LucideIcon;
  /** A list means any one of the permissions. */
  permission?: string | readonly string[];
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
      { to: '/hr/my-attendance', labelKey: 'nav.myAttendance', icon: Clock },
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
      {
        to: '/hr/timesheet',
        labelKey: 'nav.timesheet',
        icon: CalendarClock,
        permission: 'attendance:read',
      },
      {
        to: '/hr/shifts',
        labelKey: 'nav.shifts',
        icon: CalendarRange,
        permission: 'attendance:read',
      },
    ],
  },
  {
    labelKey: 'nav.groups.assets',
    items: [
      { to: '/assets/my', labelKey: 'nav.myAssets', icon: Laptop },
      { to: '/assets', labelKey: 'nav.assetList', icon: PackageCheck, permission: 'assets:read' },
      {
        to: '/assets/assignments',
        labelKey: 'nav.assignments',
        icon: ArrowLeftRight,
        permission: 'assets:read',
      },
      {
        to: '/assets/counts',
        labelKey: 'nav.assetCounts',
        icon: ScanQrCode,
        permission: 'assets:read',
      },
      {
        to: '/assets/settings',
        labelKey: 'nav.assetSettings',
        icon: SlidersHorizontal,
        permission: 'assets:update',
      },
    ],
  },
  {
    labelKey: 'nav.groups.inventory',
    items: [
      { to: '/inventory', labelKey: 'nav.stockLevels', icon: Boxes, permission: 'inventory:read' },
      {
        to: '/inventory/products',
        labelKey: 'nav.products',
        icon: Package,
        permission: 'inventory:read',
      },
      {
        to: '/inventory/movements',
        labelKey: 'nav.stockMovements',
        icon: ArrowDownUp,
        permission: 'inventory:read',
      },
      {
        to: '/inventory/counts',
        labelKey: 'nav.stockCounts',
        icon: ClipboardList,
        permission: 'inventory:read',
      },
      {
        to: '/inventory/settings',
        labelKey: 'nav.inventorySettings',
        icon: Warehouse,
        permission: 'inventory:update',
      },
    ],
  },
  {
    labelKey: 'nav.groups.purchasing',
    items: [
      {
        to: '/purchasing/requests',
        labelKey: 'nav.purchaseRequests',
        icon: ClipboardPen,
        permission: ['workflow:start', 'purchasing:create', 'purchasing:read'],
      },
      {
        to: '/purchasing/quotes',
        labelKey: 'nav.supplierQuotes',
        icon: FileSpreadsheet,
        permission: 'purchasing:read',
      },
      {
        to: '/purchasing/orders',
        labelKey: 'nav.purchaseOrders',
        icon: ShoppingCart,
        permission: 'purchasing:read',
      },
      {
        to: '/purchasing/receipts',
        labelKey: 'nav.goodsReceipts',
        icon: PackageOpen,
        permission: 'purchasing:read',
      },
      {
        to: '/purchasing/invoices',
        labelKey: 'nav.purchaseInvoices',
        icon: FileText,
        permission: ['purchasing:read', 'finance:read'],
      },
    ],
  },
  {
    labelKey: 'nav.groups.finance',
    items: [
      { to: '/partners', labelKey: 'nav.partners', icon: Contact, permission: 'partners:read' },
    ],
  },
  {
    labelKey: 'nav.groups.modules',
    items: [
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

/** The most specific nav target containing `pathname`, so `/assets/my` doesn't also light `/assets`. */
export function findActiveNavTarget(pathname: string): string | undefined {
  let best: string | undefined;
  for (const item of NAVIGATION.flatMap((group) => group.items)) {
    const to = item.to;
    if (!to) continue;
    const matches =
      to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);
    if (matches && (!best || to.length > best.length)) best = to;
  }
  return best;
}
