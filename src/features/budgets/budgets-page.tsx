import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from '@tanstack/react-router';
import { BellRing, ListTree, Loader2, Plus, ReceiptText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import { useBudgetsList, useBudgetsRun } from '@/api/generated/endpoints/budgets/budgets';
import type { BudgetDto, BudgetListDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { CHART_COLORS, compactNumber, KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  BudgetStateBadge,
  BudgetStatusBadge,
  budgetYears,
  formatPercent,
  monthShort,
  UsageBar,
  useInvalidateBudgets,
} from './budget-components';
import { CreateBudgetDialog } from './budget-dialogs';

/** Budgets of a year: company and department plans against actuals so far. */
export function BudgetsPage({
  year,
  onYearChange,
}: {
  year: number;
  onYearChange: (year: number) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateBudgets();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useBudgetsList({ year });
  const run = useBudgetsRun();
  const currency = data?.currencyCode ?? 'TRY';
  const money = (value: string | number) => formatMoney(value, currency);
  const company = data?.budgets.find((b) => b.departmentId === null);
  const years = budgetYears();
  if (!years.includes(year)) years.push(year);

  const columns = useMemo<ColumnDef<BudgetDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('budgets.budget'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.departmentName ?? t('budgets.companyWide')}
            </span>
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            <BudgetStatusBadge status={row.original.status} />
            {row.original.revision > 0 && (
              <span className="text-muted-foreground text-xs">
                {t('budgets.revisionShort', { revision: row.original.revision })}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'owner',
        header: t('budgets.owner'),
        cell: ({ row }) => row.original.ownerName ?? '—',
      },
      {
        id: 'expensePlanned',
        header: t('budgets.expensePlanned'),
        cell: ({ row }) => (
          <span className="tabular-nums">{money(row.original.expensePlanned)}</span>
        ),
      },
      {
        id: 'expenseYtd',
        header: t('budgets.expenseYtd'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {money(row.original.expenseActualYtd)}
            <span className="text-muted-foreground block text-xs">
              {t('budgets.planValue', { value: money(row.original.expensePlannedYtd) })}
            </span>
          </span>
        ),
      },
      {
        id: 'usage',
        header: t('budgets.usage'),
        cell: ({ row }) => <UsageBar value={row.original.expenseUtilization} className="w-40" />,
      },
      {
        id: 'incomeYtd',
        header: t('budgets.incomeYtd'),
        cell: ({ row }) =>
          Number(row.original.incomePlanned) || Number(row.original.incomeActualYtd) ? (
            <span className="tabular-nums">
              {money(row.original.incomeActualYtd)}
              <span className="text-muted-foreground block text-xs">
                {t('budgets.planValue', { value: money(row.original.incomePlannedYtd) })}
              </span>
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'attention',
        header: t('budgets.attentionShort'),
        cell: ({ row }) => (
          <span className="flex flex-wrap gap-1">
            {row.original.overCount > 0 && (
              <ToneBadge tone="danger">
                {t('budgets.overCount', { count: row.original.overCount })}
              </ToneBadge>
            )}
            {row.original.warningCount + row.original.behindCount > 0 && (
              <ToneBadge tone="warning">
                {t('budgets.warningCount', {
                  count: row.original.warningCount + row.original.behindCount,
                })}
              </ToneBadge>
            )}
            {row.original.overCount + row.original.warningCount + row.original.behindCount ===
              0 && <span className="text-muted-foreground text-xs">—</span>}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, currency],
  );

  const runNow = () =>
    run.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('budgets.runDone', { ...result }));
        await invalidate();
      },
    });

  const sum = (pick: (b: BudgetDto) => number) =>
    (data?.budgets ?? []).reduce((total, b) => total + pick(b), 0);

  return (
    <>
      <PageHeader
        title={t('budgets.title')}
        description={t('budgets.subtitle')}
        actions={
          <>
            <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
              <SelectTrigger className="w-28" aria-label={t('budgets.year')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Can permission="budgets:read">
              <Button variant="outline" asChild>
                <Link to="/budgets/entries">
                  <ReceiptText /> {t('budgets.entries.title')}
                </Link>
              </Button>
            </Can>
            <Can permission="budgets:update">
              <Button variant="outline" asChild>
                <Link to="/budgets/items">
                  <ListTree /> {t('budgets.items.title')}
                </Link>
              </Button>
              <Button variant="outline" disabled={run.isPending} onClick={runNow}>
                {run.isPending ? <Loader2 className="animate-spin" /> : <BellRing />}
                {t('budgets.runNow')}
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t('budgets.new')}
              </Button>
            </Can>
          </>
        }
      />
      {data && data.elapsedMonths > 0 && data.elapsedMonths < 12 && (
        <p className="text-muted-foreground -mt-2 mb-4 text-sm">
          {t('budgets.ytdHint', { month: monthShort(data.elapsedMonths) })}
        </p>
      )}
      {data?.budgets.length !== 0 && (
        <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label={t('budgets.kpi.expensePlanned')}
            value={data && (company ? money(company.expensePlanned) : '—')}
            hint={data && (company ? company.name : t('budgets.noCompanyBudget'))}
          />
          <KpiCard
            label={t('budgets.kpi.expenseActual')}
            value={data && (company ? money(company.expenseActualYtd) : '—')}
            tone={
              company?.expenseUtilization != null && company.expenseUtilization > 100
                ? 'negative'
                : undefined
            }
            hint={
              company &&
              t('budgets.kpi.ofPlan', {
                plan: money(company.expensePlannedYtd),
                percent: formatPercent(company.expenseUtilization),
              })
            }
          />
          <KpiCard
            label={t('budgets.kpi.incomeActual')}
            value={data && (company ? money(company.incomeActualYtd) : '—')}
            tone={
              company && Number(company.incomeActualYtd) >= Number(company.incomePlannedYtd)
                ? 'positive'
                : undefined
            }
            hint={
              company &&
              t('budgets.kpi.ofPlan', {
                plan: money(company.incomePlannedYtd),
                percent: formatPercent(
                  Number(company.incomePlannedYtd)
                    ? Math.round(
                        (Number(company.incomeActualYtd) / Number(company.incomePlannedYtd)) * 1000,
                      ) / 10
                    : null,
                ),
              })
            }
          />
          <KpiCard
            label={t('budgets.kpi.over')}
            value={data && sum((b) => b.overCount)}
            tone={data && sum((b) => b.overCount) > 0 ? 'negative' : undefined}
            hint={
              data &&
              t('budgets.kpi.overHint', {
                warning: sum((b) => b.warningCount),
                behind: sum((b) => b.behindCount),
              })
            }
          />
        </div>
      )}
      <div className="mb-4">
        <DataTable
          columns={columns}
          data={data?.budgets}
          isLoading={isLoading}
          searchable={false}
          onRowClick={(row) => void navigate({ to: '/budgets/$id', params: { id: row.id } })}
        />
      </div>
      {data?.budgets.length !== 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <AttentionCard data={data} />
          <DepartmentsChart data={data} />
        </div>
      )}
      <CreateBudgetDialog year={year} open={creating} onOpenChange={setCreating} />
    </>
  );
}

/** Items furthest from their plan across the year's budgets. */
function AttentionCard({ data }: { data: BudgetListDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('budgets.attention')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!data && <Skeleton className="h-52" />}
        {data && !data.attention.length && (
          <p className="text-muted-foreground text-sm">{t('budgets.noAttention')}</p>
        )}
        {data && data.attention.length > 0 && (
          <ul className="divide-y text-sm">
            {data.attention.map((a) => (
              <li key={`${a.budgetId}-${a.itemId}`} className="flex items-center gap-3 py-2">
                <Link
                  to="/budgets/$id"
                  params={{ id: a.budgetId }}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate font-medium">{a.itemName}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {a.budgetName} · {formatMoney(a.actualYtd, data.currencyCode)} /{' '}
                    {formatMoney(a.plannedYtd, data.currencyCode)}
                  </span>
                </Link>
                <span className="shrink-0 text-right">
                  <BudgetStateBadge state={a.state} />
                  <span className="text-muted-foreground block text-xs tabular-nums">
                    {a.utilization === null ? t('budgets.unplanned') : formatPercent(a.utilization)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

/** Year-to-date expense plan and actual per department budget. */
function DepartmentsChart({ data }: { data: BudgetListDto | undefined }) {
  const { t } = useTranslation();
  const rows = (data?.budgets ?? [])
    .filter((b) => b.departmentId !== null)
    .map((b) => ({
      name: b.departmentName,
      planned: Number(b.expensePlannedYtd),
      actual: Number(b.expenseActualYtd),
    }));
  if (data && !rows.length) return null;
  const currency = data?.currencyCode ?? 'TRY';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('budgets.byDepartment')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!data ? (
          <Skeleton className="h-60" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={rows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={11}
                width={56}
                tickFormatter={compactNumber}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                formatter={(value) => formatMoney(Number(value), currency)}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="planned"
                name={t('budgets.plannedYtd')}
                fill={CHART_COLORS.muted}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
              <Bar
                dataKey="actual"
                name={t('budgets.actualYtd')}
                fill={CHART_COLORS.primary}
                radius={[4, 4, 0, 0]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
