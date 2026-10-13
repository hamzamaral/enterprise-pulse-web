import { Link, useNavigate } from '@tanstack/react-router';
import { BellRing, Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
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
import {
  contractsFindAll,
  useContractsFindAll,
  useContractsRun,
  useContractsSummary,
  useContractTypesFindAll,
} from '@/api/generated/endpoints/contracts/contracts';
import type {
  ContractParty,
  ContractsFindAllParams,
  ContractSummaryDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { CHART_COLORS, KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  ContractStateBadge,
  formatContractAmount,
  useContractColumns,
  useInvalidateContracts,
} from './contract-components';
import { ContractFormDialog } from './contract-form-dialog';

const VIEWS = ['active', 'expiring', 'mine', 'draft', 'expired', 'terminated', 'all'] as const;
type View = (typeof VIEWS)[number];
const ALL = '__all__';
const PARTIES: ContractParty[] = ['PARTNER', 'EMPLOYEE'];

const VIEW_PARAMS: Record<View, ContractsFindAllParams> = {
  active: { status: 'ACTIVE' },
  expiring: { expiring: 'true' },
  mine: { status: 'ACTIVE', ownerId: 'me' },
  draft: { status: 'DRAFT' },
  expired: { status: 'EXPIRED' },
  terminated: { status: 'TERMINATED' },
  all: {},
};

/** Contract register with the dashboard: values, upcoming ends and the next decisions. */
export function ContractsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateContracts();
  const table = useTableState({ sort: [{ id: 'endDate', desc: false }] });
  const [view, setView] = useState<View>('active');
  const [party, setParty] = useState(ALL);
  const [typeId, setTypeId] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const { data: summary } = useContractsSummary();
  const { data: types } = useContractTypesFindAll();
  const run = useContractsRun();
  const params: ContractsFindAllParams = {
    ...table.params,
    ...VIEW_PARAMS[view],
    party: party === ALL ? undefined : (party as ContractParty),
    typeId: typeId === ALL ? undefined : typeId,
  };
  const { data, isLoading } = useContractsFindAll(params, { query: tableQuery });
  const columns = useContractColumns();
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const tryValue = summary?.values.find((v) => v.currencyCode === 'TRY');
  const otherValues = summary?.values.filter((v) => v.currencyCode !== 'TRY') ?? [];
  const otherText = (kind: 'income' | 'expense') =>
    otherValues
      .filter((v) => Number(v[kind]) > 0)
      .map((v) => formatMoney(v[kind], v.currencyCode))
      .join(' · ');

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      contractsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'contracts',
      [
        { header: t('contracts.number'), value: (r) => r.number },
        { header: t('contracts.titleLabel'), value: (r) => r.title },
        { header: t('contracts.type'), value: (r) => r.typeName },
        { header: t('contracts.partyLabel'), value: (r) => r.partyName },
        { header: t('contracts.owner'), value: (r) => r.ownerName },
        { header: t('contracts.startDate'), value: (r) => new Date(r.startDate) },
        { header: t('contracts.endDate'), value: (r) => (r.endDate ? new Date(r.endDate) : null) },
        { header: t('contracts.amount'), value: (r) => (r.amount ? Number(r.amount) : null) },
        { header: t('contracts.currency'), value: (r) => r.currencyCode },
        {
          header: t('contracts.billingCycle'),
          value: (r) => t(`contracts.cycle.${r.billingCycle}`),
        },
        {
          header: t('contracts.annualValue'),
          value: (r) => (r.annualValue ? Number(r.annualValue) : null),
        },
        { header: t('contracts.autoRenew'), value: (r) => (r.autoRenew ? t('common.yes') : '') },
        {
          header: t('contracts.noticeDeadline'),
          value: (r) => (r.noticeDeadline ? new Date(r.noticeDeadline) : null),
        },
        { header: t('common.status'), value: (r) => t(`contracts.state.${r.state}`) },
      ],
      rows,
    );
  };

  const runNow = () =>
    run.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('contracts.runDone', { ...result }));
        await invalidate();
      },
    });

  return (
    <>
      <PageHeader
        title={t('contracts.title')}
        description={t('contracts.subtitle')}
        actions={
          <>
            <Can permission="contracts:update">
              <Button variant="outline" disabled={run.isPending} onClick={runNow}>
                {run.isPending ? <Loader2 className="animate-spin" /> : <BellRing />}
                {t('contracts.runNow')}
              </Button>
              <Button variant="outline" asChild>
                <Link to="/contracts/types">{t('contracts.types.title')}</Link>
              </Button>
            </Can>
            <Can permission="contracts:create">
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t('contracts.new')}
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('contracts.summary.active')}
          value={summary?.activeCount}
          hint={
            summary &&
            t('contracts.summary.activeHint', {
              autoRenew: summary.autoRenewCount,
              draft: summary.draftCount,
            })
          }
        />
        <KpiCard
          label={t('contracts.summary.expiring')}
          value={summary?.expiringCount}
          tone={summary?.expiringCount ? 'negative' : undefined}
          hint={
            summary &&
            t('contracts.summary.expiringHint', {
              terminating: summary.terminatingCount,
              ended: summary.endedRecentlyCount,
            })
          }
        />
        <KpiCard
          label={t('contracts.summary.income')}
          value={summary && formatMoney(tryValue?.income ?? 0)}
          tone="positive"
          hint={summary && (otherText('income') || t('contracts.summary.yearly'))}
        />
        <KpiCard
          label={t('contracts.summary.expense')}
          value={summary && formatMoney(tryValue?.expense ?? 0)}
          hint={summary && (otherText('expense') || t('contracts.summary.yearly'))}
        />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <UpcomingCard summary={summary} />
        <NextActionsCard summary={summary} />
      </div>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/contracts/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={view}
              onValueChange={(value) => {
                setView(value as View);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44" aria-label={t('contracts.view')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`contracts.views.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={party}
              onValueChange={(value) => {
                setParty(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-36" aria-label={t('contracts.partyLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('contracts.allParties')}</SelectItem>
                {PARTIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`contracts.party.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={typeId}
              onValueChange={(value) => {
                setTypeId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48" aria-label={t('contracts.type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('contracts.allTypes')}</SelectItem>
                {(types ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <ContractFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(contract) => void navigate({ to: '/contracts/$id', params: { id: contract.id } })}
      />
    </>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

/** Contracts ending or renewing in each of the next 12 months. */
function UpcomingCard({ summary }: { summary: ContractSummaryDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('contracts.summary.upcoming')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <Skeleton className="h-52" />
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            <BarChart
              data={summary.upcoming.map((m) => ({
                ...m,
                label: formatDate(`${m.month}-01`, 'MMM yy'),
              }))}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={28}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="ending"
                stackId="month"
                name={t('contracts.summary.ending')}
                fill={CHART_COLORS.primary}
                maxBarSize={22}
              />
              <Bar
                dataKey="renewing"
                stackId="month"
                name={t('contracts.summary.renewing')}
                fill={CHART_COLORS.secondary}
                radius={[4, 4, 0, 0]}
                maxBarSize={22}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** The closest end dates, notice deadlines and scheduled terminations. */
function NextActionsCard({ summary }: { summary: ContractSummaryDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('contracts.summary.nextActions')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary && <Skeleton className="h-52" />}
        {summary && !summary.nextActions.length && (
          <p className="text-muted-foreground text-sm">{t('contracts.summary.noActions')}</p>
        )}
        {summary && summary.nextActions.length > 0 && (
          <ul className="divide-y text-sm">
            {summary.nextActions.map((c) => {
              const deadline = c.terminatedOn ?? (c.autoRenew ? c.noticeDeadline : c.endDate);
              const kind = c.terminatedOn ? 'terminates' : c.autoRenew ? 'notice' : 'ends';
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <Link
                    to="/contracts/$id"
                    params={{ id: c.id }}
                    className="min-w-0 flex-1 hover:underline"
                  >
                    <span className="block truncate font-medium">{c.title}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {c.partyName} ·{' '}
                      {formatContractAmount(c.amount, c.currencyCode, c.billingCycle)}
                    </span>
                  </Link>
                  <span className="shrink-0 text-right">
                    <ContractStateBadge state={c.state} />
                    <span className="text-muted-foreground block text-xs">
                      {t(`contracts.summary.${kind}`, { date: formatDate(deadline) })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
