import { Link, type LinkProps } from '@tanstack/react-router';
import {
  Bell,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  HandCoins,
  Landmark,
  Laptop,
  MapPin,
  PackageCheck,
  ShoppingCart,
  TriangleAlert,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useAssetAssignmentsFindMine,
  useAssetsFindAll,
} from '@/api/generated/endpoints/assets/assets';
import { useAuditFindAll } from '@/api/generated/endpoints/audit/audit';
import {
  useEmployeesFindAll,
  useEmployeesFindMine,
} from '@/api/generated/endpoints/employees/employees';
import { useFinanceReportsSummary } from '@/api/generated/endpoints/finance/finance';
import { useStockFindLevels, useStockSummary } from '@/api/generated/endpoints/inventory/inventory';
import {
  useLeaveBalancesFindAll,
  useLeaveRequestsFindAll,
} from '@/api/generated/endpoints/leave/leave';
import type { LeaveBalanceDto } from '@/api/generated/model';
import { useNotificationsUnreadCount } from '@/api/generated/endpoints/notifications/notifications';
import { useUsersFindAll } from '@/api/generated/endpoints/users/users';
import {
  useWorkflowInstancesFindAll,
  useWorkflowInstancesInbox,
} from '@/api/generated/endpoints/workflow/workflow';
import { NAVIGATION } from '@/app/layout/navigation';
import { useMe, usePermission } from '@/features/auth/use-session';
import { itemName } from '@/features/inventory/inventory-components';
import { WorkflowStatusBadge } from '@/features/workflow/workflow-components';
import { formatMoney, formatQuantity, formatRelative } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
}: {
  label: string;
  value: ReactNode | undefined;
  hint?: string;
  icon: LucideIcon;
  to?: LinkProps['to'];
}) {
  const content = (
    <Card className="hover:border-primary/40 h-full transition-colors">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="text-muted-foreground text-sm">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {value === undefined ? <Skeleton className="h-7 w-10" /> : value}
          </div>
          {hint && <div className="text-muted-foreground truncate text-xs">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

function EmptyState() {
  const { t } = useTranslation();
  return <p className="text-muted-foreground py-6 text-center text-sm">{t('common.noResults')}</p>;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const can = usePermission();

  const users = useUsersFindAll(
    { pageSize: 1, isActive: 'true' },
    { query: { enabled: can('users:read') } },
  );
  const inbox = useWorkflowInstancesInbox({ pageSize: 1 });
  const unread = useNotificationsUnreadCount();
  const activity = useAuditFindAll({ pageSize: 6 }, { query: { enabled: can('audit:read') } });
  const myRequests = useWorkflowInstancesFindAll(
    { pageSize: 5, mine: 'true' },
    { query: { enabled: can('workflow:read') } },
  );

  const employees = useEmployeesFindAll(
    { pageSize: 1, status: 'ACTIVE' },
    { query: { enabled: can('employees:read') } },
  );
  const pendingLeave = useLeaveRequestsFindAll(
    { pageSize: 1, status: 'PENDING' },
    { query: { enabled: can('leave:read') } },
  );
  const assets = useAssetsFindAll({ pageSize: 1 }, { query: { enabled: can('assets:read') } });
  const assignedAssets = useAssetsFindAll(
    { pageSize: 1, status: 'ASSIGNED' },
    { query: { enabled: can('assets:read') } },
  );
  const stock = useStockSummary({ query: { enabled: can('inventory:read') } });
  const lowStock = useStockFindLevels(
    { lowStock: true, pageSize: 6, sortBy: 'quantity', sortOrder: 'asc' },
    { query: { enabled: can('inventory:read') } },
  );

  const finance = useFinanceReportsSummary({ query: { enabled: can('finance:read') } });

  const myEmployee = useEmployeesFindMine({ query: { enabled: !!me?.employeeId } });
  const myBalances = useLeaveBalancesFindAll(
    { employeeId: myEmployee.data?.id, year: new Date().getFullYear() },
    { query: { enabled: myEmployee.isSuccess } },
  );
  const myAssignments = useAssetAssignmentsFindMine({ query: { enabled: myEmployee.isSuccess } });
  const annualBalance = myBalances.data?.reduce<LeaveBalanceDto | undefined>(
    (best, balance) => (!best || balance.entitledDays > best.entitledDays ? balance : best),
    undefined,
  );
  const activeAssignments = myAssignments.data?.filter((a) => a.status === 'ACTIVE');
  const unacknowledged = activeAssignments?.filter((a) => !a.acknowledgedAt).length ?? 0;

  const company = me?.companies.find((c) => c.id === me.activeCompanyId);
  const roadmap = NAVIGATION.flatMap((g) => g.items).filter((i) => i.comingSoon);
  const showModules =
    can('employees:read') || can('leave:read') || can('assets:read') || can('inventory:read');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('dashboard.welcome', { name: me?.user.firstName })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {company?.name} · {t('dashboard.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can('users:read') && (
          <StatCard
            label={t('dashboard.users')}
            value={users.data?.meta.total}
            icon={Users}
            to="/users"
          />
        )}
        <StatCard
          label={t('dashboard.branches')}
          value={company?.branches.length}
          icon={MapPin}
          to="/branches"
        />
        <StatCard
          label={t('dashboard.pendingApprovals')}
          value={inbox.data?.meta.total}
          icon={ClipboardCheck}
          to="/workflow/inbox"
        />
        <StatCard
          label={t('dashboard.unread')}
          value={unread.data?.count}
          icon={Bell}
          to="/notifications"
        />
      </div>

      {myEmployee.isSuccess && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.myLeaveBalance')}
            value={
              myBalances.data
                ? t('dashboard.days', { count: annualBalance?.remainingDays ?? 0 })
                : undefined
            }
            hint={annualBalance?.leaveTypeName}
            icon={CalendarDays}
            to="/hr/my-leave"
          />
          <StatCard
            label={t('dashboard.myAssets')}
            value={activeAssignments?.length}
            hint={
              unacknowledged
                ? t('dashboard.awaitingAcknowledgement', { count: unacknowledged })
                : undefined
            }
            icon={PackageCheck}
            to="/assets/my"
          />
        </div>
      )}

      {showModules && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {can('employees:read') && (
            <StatCard
              label={t('dashboard.activeEmployees')}
              value={employees.data?.meta.total}
              icon={UserRound}
              to="/hr/employees"
            />
          )}
          {can('leave:read') && (
            <StatCard
              label={t('dashboard.pendingLeave')}
              value={pendingLeave.data?.meta.total}
              icon={CalendarClock}
              to="/hr/leave-requests"
            />
          )}
          {can('assets:read') && (
            <StatCard
              label={t('dashboard.assignedAssets')}
              value={
                assignedAssets.data && assets.data
                  ? `${assignedAssets.data.meta.total} / ${assets.data.meta.total}`
                  : undefined
              }
              icon={Laptop}
              to="/assets"
            />
          )}
          {can('inventory:read') && (
            <StatCard
              label={t('dashboard.stockValue')}
              value={stock.data ? formatMoney(stock.data.stockValue) : undefined}
              hint={
                stock.data
                  ? t('dashboard.stockHint', {
                      items: stock.data.itemCount,
                      warehouses: stock.data.warehouseCount,
                    })
                  : undefined
              }
              icon={Boxes}
              to="/inventory"
            />
          )}
        </div>
      )}

      {can('finance:read') && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t('dashboard.receivables')}
            value={
              finance.data
                ? formatMoney(finance.data.receivables, finance.data.baseCurrency)
                : undefined
            }
            hint={
              finance.data && Number(finance.data.overdueReceivables)
                ? t('dashboard.overdueHint', {
                    amount: formatMoney(finance.data.overdueReceivables, finance.data.baseCurrency),
                  })
                : undefined
            }
            icon={HandCoins}
            to="/finance/aging"
          />
          <StatCard
            label={t('dashboard.payables')}
            value={
              finance.data
                ? formatMoney(finance.data.payables, finance.data.baseCurrency)
                : undefined
            }
            hint={
              finance.data && Number(finance.data.overduePayables)
                ? t('dashboard.overdueHint', {
                    amount: formatMoney(finance.data.overduePayables, finance.data.baseCurrency),
                  })
                : undefined
            }
            icon={Wallet}
            to="/finance/payments"
          />
          <StatCard
            label={t('dashboard.cashPosition')}
            value={
              finance.data
                ? formatMoney(finance.data.cashPosition, finance.data.baseCurrency)
                : undefined
            }
            hint={
              finance.data && Number(finance.data.chequesInPortfolio)
                ? t('dashboard.chequesHint', {
                    amount: formatMoney(finance.data.chequesInPortfolio, finance.data.baseCurrency),
                  })
                : undefined
            }
            icon={Landmark}
            to="/finance/accounts"
          />
          <StatCard
            label={t('dashboard.openPurchaseOrders')}
            value={finance.data?.openPurchaseOrders}
            hint={
              finance.data
                ? t('dashboard.openSalesOrdersHint', { count: finance.data.openSalesOrders })
                : undefined
            }
            icon={ShoppingCart}
            to="/purchasing/orders"
          />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {can('inventory:read') && (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <TriangleAlert className="text-destructive size-4" />
                {t('dashboard.lowStock')}
                {stock.data ? (
                  <Badge variant="outline" className="tabular-nums">
                    {stock.data.lowStockCount}
                  </Badge>
                ) : null}
              </CardTitle>
              <Link
                to="/inventory"
                search={{ lowStock: true }}
                className="text-primary text-sm hover:underline"
              >
                {t('dashboard.viewAll')}
              </Link>
            </CardHeader>
            <CardContent>
              {lowStock.data?.data.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {lowStock.data.data.map((row) => (
                    <Link
                      key={row.variantId}
                      to="/inventory/products/$id"
                      params={{ id: row.productId }}
                      className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {itemName(row.productName, row.variantName)}
                        </div>
                        <code className="text-muted-foreground text-xs">{row.sku}</code>
                      </div>
                      <div className="shrink-0 text-right text-sm tabular-nums">
                        <div className="text-destructive font-medium">
                          {formatQuantity(row.quantity, row.unitCode)}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {t('dashboard.minimum')}: {formatQuantity(row.minStock)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : lowStock.isLoading ? (
                <Skeleton className="h-16" />
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </Card>
        )}

        {can('workflow:read') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.myRequests')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {myRequests.data?.data.length ? (
                myRequests.data.data.map((instance) => (
                  <Link
                    key={instance.id}
                    to="/workflow/instances/$id"
                    params={{ id: instance.id }}
                    className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md px-2 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{instance.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatRelative(instance.startedAt)}
                      </div>
                    </div>
                    <WorkflowStatusBadge status={instance.status} />
                  </Link>
                ))
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </Card>
        )}

        {can('audit:read') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              {activity.data?.data.length ? (
                <ol className="space-y-3">
                  {activity.data.data.map((log) => (
                    <li key={log.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">{log.userEmail ?? 'system'}</span>{' '}
                        <span className="text-muted-foreground">
                          {t(`audit.actions.${log.action}` as never, { defaultValue: log.action })}{' '}
                          · {log.entityType}
                        </span>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {formatRelative(log.createdAt)}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState />
              )}
            </CardContent>
          </Card>
        )}

        {roadmap.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.roadmap')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {roadmap.map((item) => (
                <div key={item.labelKey} className="flex items-center gap-3 rounded-lg border p-3">
                  <item.icon className="text-muted-foreground size-5" />
                  <span className="text-sm font-medium">{t(item.labelKey as never)}</span>
                  <Badge variant="outline" className="ml-auto">
                    {t('nav.comingSoon')}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
