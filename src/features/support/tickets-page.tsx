import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
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
import {
  ticketsFindAll,
  useTicketCategoriesFindAll,
  useTicketsFindAll,
  useTicketsSummary,
} from '@/api/generated/endpoints/support/support';
import type {
  SupportSummaryDto,
  TicketDto,
  TicketPriority,
  TicketsFindAllParams,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { Rating } from '@/features/recruitment/recruitment-components';
import { CHART_COLORS, KpiCard } from '@/features/reports/report-components';
import { formatDecimal } from '@/features/training/training-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatDateTime, formatRelative } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  formatHours,
  PRIORITIES,
  SlaCell,
  TicketPriorityBadge,
  TicketStatusBadge,
} from './support-components';
import { TicketFormDialog } from './ticket-form-dialog';

const VIEWS = ['active', 'mine', 'unassigned', 'overdue', 'waiting', 'resolved', 'all'] as const;
type View = (typeof VIEWS)[number];
const ALL = '__all__';

const VIEW_PARAMS: Record<View, TicketsFindAllParams> = {
  active: { active: 'true' },
  mine: { active: 'true', assignee: 'me' },
  unassigned: { active: 'true', assignee: 'unassigned' },
  overdue: { overdue: 'true' },
  waiting: { status: 'WAITING' },
  resolved: { status: 'RESOLVED' },
  all: {},
};

/** The support queue for agents. */
export function TicketsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState();
  const [view, setView] = useState<View>('active');
  const [priority, setPriority] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const { data: summary } = useTicketsSummary();
  const { data: categories } = useTicketCategoriesFindAll();
  const params: TicketsFindAllParams = {
    ...table.params,
    ...VIEW_PARAMS[view],
    priority: priority === ALL ? undefined : (priority as TicketPriority),
    categoryId: categoryId === ALL ? undefined : categoryId,
  };
  const { data, isLoading } = useTicketsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<TicketDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('support.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'subject',
        header: t('support.subject'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.subject}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.requesterName} · {row.original.categoryName ?? t('support.noCategory')}
            </span>
          </span>
        ),
      },
      {
        id: 'priority',
        header: t('support.priorityLabel'),
        cell: ({ row }) => <TicketPriorityBadge priority={row.original.priority} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <TicketStatusBadge status={row.original.status} />,
      },
      {
        id: 'assignee',
        header: t('support.assignee'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.assigneeName ?? (
            <span className="text-muted-foreground">{t('support.unassigned')}</span>
          ),
      },
      {
        id: 'resolutionDueAt',
        header: t('support.sla.title'),
        cell: ({ row }) => <SlaCell ticket={row.original} />,
      },
      {
        id: 'createdAt',
        header: t('support.opened'),
        cell: ({ row }) => (
          <span className="text-sm" title={formatDateTime(row.original.createdAt)}>
            {formatRelative(row.original.createdAt)}
            {row.original.satisfactionRating !== null && (
              <span className="block">
                <Rating value={row.original.satisfactionRating} />
              </span>
            )}
          </span>
        ),
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => ticketsFindAll({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      'tickets',
      [
        { header: t('support.number'), value: (r) => r.number },
        { header: t('support.subject'), value: (r) => r.subject },
        { header: t('support.requester'), value: (r) => r.requesterName },
        { header: t('support.category'), value: (r) => r.categoryName },
        { header: t('support.priorityLabel'), value: (r) => t(`support.priority.${r.priority}`) },
        { header: t('common.status'), value: (r) => t(`support.status.${r.status}`) },
        { header: t('support.assignee'), value: (r) => r.assigneeName },
        { header: t('support.opened'), value: (r) => new Date(r.createdAt) },
        { header: t('support.responseDue'), value: (r) => new Date(r.firstResponseDueAt) },
        {
          header: t('support.respondedAt'),
          value: (r) => (r.firstRespondedAt ? new Date(r.firstRespondedAt) : null),
        },
        { header: t('support.resolutionDue'), value: (r) => new Date(r.resolutionDueAt) },
        {
          header: t('support.resolvedAt'),
          value: (r) => (r.resolvedAt ? new Date(r.resolvedAt) : null),
        },
        { header: t('support.sla.response'), value: (r) => t(`support.sla.${r.responseSla}`) },
        {
          header: t('support.sla.resolution'),
          value: (r) => t(`support.sla.${r.resolutionSla}`),
        },
        { header: t('support.satisfaction'), value: (r) => r.satisfactionRating },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('support.queue.title')}
        description={t('support.queue.subtitle')}
        actions={
          <>
            <Can permission="support:update">
              <Button variant="outline" asChild>
                <Link to="/support/settings">{t('support.settings.title')}</Link>
              </Button>
            </Can>
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('support.new')}
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('support.summary.active')}
          value={summary?.activeCount}
          hint={
            summary &&
            t('support.summary.activeHint', {
              unassigned: summary.unassignedCount,
              waiting: summary.waitingCount,
            })
          }
        />
        <KpiCard
          label={t('support.summary.overdue')}
          value={summary?.overdueCount}
          tone={summary?.overdueCount ? 'negative' : undefined}
          hint={summary && t('support.summary.atRisk', { count: summary.atRiskCount })}
        />
        <KpiCard
          label={t('support.summary.firstResponse')}
          value={summary && formatHours(summary.averageFirstResponseHours)}
          hint={
            summary &&
            t('support.summary.resolutionTime', {
              value: formatHours(summary.averageResolutionHours),
            })
          }
        />
        <KpiCard
          label={t('support.summary.slaRate')}
          value={
            summary &&
            (summary.slaComplianceRate === null
              ? '—'
              : `%${formatDecimal(summary.slaComplianceRate)}`)
          }
          tone={
            summary && summary.slaComplianceRate !== null
              ? summary.slaComplianceRate >= 90
                ? 'positive'
                : 'negative'
              : undefined
          }
          hint={
            summary &&
            (summary.satisfactionAverage === null
              ? t('support.summary.noRatings')
              : t('support.summary.satisfaction', {
                  value: formatDecimal(summary.satisfactionAverage, 1),
                  count: summary.satisfactionCount,
                }))
          }
        />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <TrendCard summary={summary} />
        <WorkloadCard summary={summary} />
      </div>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/support/tickets/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={view}
              onValueChange={(value) => {
                setView(value as View);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48" aria-label={t('support.queue.view')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`support.queue.views.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priority}
              onValueChange={(value) => {
                setPriority(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-40" aria-label={t('support.priorityLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('support.allPriorities')}</SelectItem>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`support.priority.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44" aria-label={t('support.category')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('support.allCategories')}</SelectItem>
                {(categories ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <TicketFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(ticket) =>
          void navigate({ to: '/support/tickets/$id', params: { id: ticket.id } })
        }
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

/** Created and resolved tickets per day over the last two weeks. */
function TrendCard({ summary }: { summary: SupportSummaryDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('support.summary.trend')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <Skeleton className="h-52" />
        ) : (
          <ResponsiveContainer width="100%" height={208}>
            <BarChart
              data={summary.trend.map((p) => ({ ...p, label: formatDate(p.date, 'dd MMM') }))}
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
                dataKey="created"
                name={t('support.summary.created')}
                fill={CHART_COLORS.primary}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
              <Bar
                dataKey="resolved"
                name={t('support.summary.resolved')}
                fill={CHART_COLORS.secondary}
                radius={[4, 4, 0, 0]}
                maxBarSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

/** Active and overdue tickets per agent, plus the priority split. */
function WorkloadCard({ summary }: { summary: SupportSummaryDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('support.summary.workload')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!summary && <Skeleton className="h-52" />}
        {summary && (
          <>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-xs">
                <tr>
                  <th className="pb-2 text-left font-normal">{t('support.agent')}</th>
                  <th className="pb-2 text-right font-normal">
                    {t('support.summary.activeShort')}
                  </th>
                  <th className="pb-2 text-right font-normal">
                    {t('support.summary.overdueShort')}
                  </th>
                  <th className="pb-2 text-right font-normal">
                    {t('support.summary.resolvedShort')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.byAgent.map((a) => (
                  <tr key={a.userId} className="border-t">
                    <td className="py-1.5">{a.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{a.active}</td>
                    <td
                      className={
                        a.overdue
                          ? 'text-destructive py-1.5 text-right tabular-nums'
                          : 'py-1.5 text-right tabular-nums'
                      }
                    >
                      {a.overdue}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{a.resolved}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2">
              {summary.byPriority.map((p) => (
                <span
                  key={p.priority}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
                >
                  <TicketPriorityBadge priority={p.priority} />
                  <span className="tabular-nums">{p.active}</span>
                  {p.overdue > 0 && (
                    <span className="text-destructive tabular-nums">
                      ({t('support.summary.overdueCount', { count: p.overdue })})
                    </span>
                  )}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
