import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReviewCyclesFindAll } from '@/api/generated/endpoints/performance/performance';
import type { ReviewCycleDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import {
  CycleStatusBadge,
  formatScore,
  percent,
  ProgressBar,
  ScoreBadge,
} from './performance-components';
import { ReviewCycleFormDialog } from './review-cycle-form-dialog';

export function ReviewCyclesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useReviewCyclesFindAll();

  const active = data?.find((c) => c.status === 'ACTIVE');
  const lastClosed = data?.find((c) => c.status === 'CLOSED');

  const columns = useMemo<ColumnDef<ReviewCycleDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.name}</span>
            <span className="text-muted-foreground block text-xs">
              {formatDate(row.original.periodStart)} – {formatDate(row.original.periodEnd)}
            </span>
          </span>
        ),
      },
      {
        id: 'due',
        header: t('performance.cycles.deadlines'),
        cell: ({ row }) => (
          <span className="text-sm">
            {t('performance.cycles.selfShort')}: {formatDate(row.original.selfReviewDue)}
            <span className="text-muted-foreground block text-xs">
              {t('performance.cycles.managerShort')}: {formatDate(row.original.managerReviewDue)}
            </span>
          </span>
        ),
      },
      {
        id: 'weight',
        header: t('performance.cycles.weighting'),
        cell: ({ row }) =>
          t('performance.cycles.weightSplit', {
            goals: row.original.goalWeight,
            competencies: 100 - row.original.goalWeight,
          }),
      },
      {
        id: 'progress',
        header: t('performance.cycles.progress'),
        cell: ({ row }) =>
          row.original.reviewCount ? (
            <span className="flex items-center gap-2">
              <ProgressBar value={percent(row.original.completedCount, row.original.reviewCount)} />
              <span className="text-muted-foreground text-xs tabular-nums">
                {row.original.completedCount} / {row.original.reviewCount}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: 'average',
        header: t('performance.averageScore'),
        cell: ({ row }) => <ScoreBadge score={row.original.averageScore} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <CycleStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    await exportTable(
      format,
      'review-cycles',
      [
        { header: t('common.name'), value: (r) => r.name },
        { header: t('performance.cycles.periodStart'), value: (r) => new Date(r.periodStart) },
        { header: t('performance.cycles.periodEnd'), value: (r) => new Date(r.periodEnd) },
        { header: t('performance.cycles.selfReviewDue'), value: (r) => new Date(r.selfReviewDue) },
        {
          header: t('performance.cycles.managerReviewDue'),
          value: (r) => new Date(r.managerReviewDue),
        },
        { header: t('performance.cycles.goalWeight'), value: (r) => r.goalWeight },
        { header: t('performance.cycles.reviews'), value: (r) => r.reviewCount },
        { header: t('performance.reviewStatus.COMPLETED'), value: (r) => r.completedCount },
        {
          header: t('performance.averageScore'),
          value: (r) => (r.averageScore === null ? null : Number(r.averageScore)),
        },
        { header: t('common.status'), value: (r) => t(`performance.cycleStatus.${r.status}`) },
      ],
      data ?? [],
    );
  };

  return (
    <>
      <PageHeader
        title={t('performance.cycles.title')}
        description={t('performance.cycles.subtitle')}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/performance/competencies">{t('performance.competencies.title')}</Link>
            </Button>
            <Can permission="performance:create">
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t('performance.cycles.new')}
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('performance.cycles.activeCycle')}
          value={data && (active?.name ?? '—')}
          hint={
            active && t('performance.cycles.dueOn', { date: formatDate(active.managerReviewDue) })
          }
        />
        <KpiCard
          label={t('performance.cycles.completion')}
          value={data && (active ? `%${percent(active.completedCount, active.reviewCount)}` : '—')}
          hint={
            active &&
            t('performance.cycles.completedOf', {
              done: active.completedCount,
              total: active.reviewCount,
            })
          }
        />
        <KpiCard
          label={t('performance.cycles.activeAverage')}
          value={data && formatScore(active?.averageScore)}
          hint={active && t('performance.cycles.soFar')}
        />
        <KpiCard
          label={t('performance.cycles.lastAverage')}
          value={data && formatScore(lastClosed?.averageScore)}
          hint={lastClosed?.name}
        />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/performance/cycles/$id', params: { id: row.id } })
        }
      />
      <ReviewCycleFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(saved) =>
          void navigate({ to: '/performance/cycles/$id', params: { id: saved.id } })
        }
      />
    </>
  );
}
