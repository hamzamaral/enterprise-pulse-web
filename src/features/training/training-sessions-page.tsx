import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  trainingSessionsFindAll,
  useTrainingSessionsFindAll,
  useTrainingsSummary,
} from '@/api/generated/endpoints/training/training';
import {
  TrainingSessionStatus,
  type TrainingSessionDto,
  type TrainingSessionsFindAllParams,
  type TrainingSummaryDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { Rating } from '@/features/recruitment/recruitment-components';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  formatDecimal,
  formatHours,
  formatSessionTime,
  SessionStatusBadge,
} from './training-components';
import { TrainingSessionFormDialog } from './training-session-form-dialog';

const UPCOMING = '__upcoming__';
const ALL = '__all__';

export function TrainingSessionsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState();
  const [filter, setFilter] = useState(UPCOMING);
  const [creating, setCreating] = useState(false);
  const { data: summary } = useTrainingsSummary();
  const params: TrainingSessionsFindAllParams = {
    ...table.params,
    status: filter === UPCOMING || filter === ALL ? undefined : (filter as TrainingSessionStatus),
    upcoming: filter === UPCOMING ? 'true' : undefined,
  };
  const { data, isLoading } = useTrainingSessionsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<TrainingSessionDto, unknown>[]>(
    () => [
      {
        id: 'course',
        header: t('training.course'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            <span className="inline-flex items-center gap-2 font-medium">
              {row.original.courseTitle}
              {row.original.isMandatory && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t('training.courses.mandatory')}
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground block text-xs">
              <code>{row.original.courseCode}</code> ·{' '}
              {t(`training.categories.${row.original.category}`)}
            </span>
          </span>
        ),
      },
      {
        id: 'startsAt',
        header: t('training.sessions.when'),
        cell: ({ row }) => (
          <span className="text-sm">
            {formatSessionTime(row.original.startsAt, row.original.endsAt)}
            <span className="text-muted-foreground block text-xs">
              {[row.original.location, row.original.instructor].filter(Boolean).join(' · ') ||
                t(`training.formats.${row.original.format}`)}
            </span>
          </span>
        ),
      },
      {
        id: 'seats',
        header: t('training.sessions.participants'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.status === 'COMPLETED'
              ? `${row.original.attendedCount} / ${row.original.enrolledCount}`
              : row.original.capacity
                ? `${row.original.enrolledCount} / ${row.original.capacity}`
                : row.original.enrolledCount}
            {row.original.selfEnrollment && row.original.status === 'PLANNED' && (
              <span className="text-muted-foreground block text-xs">
                {t('training.sessions.openToAll')}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'feedback',
        header: t('training.sessions.feedback'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.averageFeedback === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Rating value={Number(row.original.averageFeedback)} />
              <span className="text-muted-foreground text-xs">({row.original.feedbackCount})</span>
            </span>
          ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <SessionStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      trainingSessionsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'training-sessions',
      [
        { header: t('common.code'), value: (r) => r.courseCode },
        { header: t('training.course'), value: (r) => r.courseTitle },
        { header: t('training.category'), value: (r) => t(`training.categories.${r.category}`) },
        { header: t('training.format'), value: (r) => t(`training.formats.${r.format}`) },
        { header: t('training.sessions.startsAt'), value: (r) => new Date(r.startsAt) },
        { header: t('training.sessions.endsAt'), value: (r) => new Date(r.endsAt) },
        { header: t('training.sessions.location'), value: (r) => r.location },
        { header: t('training.sessions.instructor'), value: (r) => r.instructor },
        { header: t('training.sessions.capacity'), value: (r) => r.capacity },
        { header: t('training.sessions.enrolled'), value: (r) => r.enrolledCount },
        { header: t('training.sessions.attended'), value: (r) => r.attendedCount },
        {
          header: t('training.sessions.cost'),
          value: (r) => (r.cost === null ? null : Number(r.cost)),
        },
        {
          header: t('training.sessions.feedback'),
          value: (r) => (r.averageFeedback === null ? null : Number(r.averageFeedback)),
        },
        { header: t('common.status'), value: (r) => t(`training.sessionStatus.${r.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('training.sessions.title')}
        description={t('training.sessions.subtitle')}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/training/courses">{t('training.courses.title')}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/training/compliance">{t('training.compliance.title')}</Link>
            </Button>
            <Can permission="training:create">
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t('training.sessions.new')}
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('training.summary.upcomingSessions')}
          value={summary?.upcomingSessions}
          hint={summary && t('training.summary.upcomingSeats', { count: summary.upcomingSeats })}
        />
        <KpiCard
          label={t('training.summary.hoursThisYear')}
          value={summary && formatHours(summary.hoursThisYear)}
          hint={
            summary && t('training.summary.participants', { count: summary.participantsThisYear })
          }
        />
        <KpiCard
          label={t('training.summary.costThisYear')}
          value={summary && formatMoney(summary.costThisYear, summary.currencyCode)}
          hint={
            summary &&
            (summary.averageFeedback === null
              ? t('training.summary.noFeedback')
              : t('training.summary.averageFeedback', {
                  value: formatDecimal(summary.averageFeedback, 1),
                }))
          }
        />
        <KpiCard
          label={t('training.summary.complianceRate')}
          value={
            summary &&
            (summary.complianceRate === null ? '—' : `%${formatDecimal(summary.complianceRate)}`)
          }
          tone={
            summary?.complianceRate !== null && summary?.complianceRate !== undefined
              ? summary.complianceRate >= 90
                ? 'positive'
                : 'negative'
              : undefined
          }
          hint={
            summary &&
            t('training.summary.complianceHint', {
              overdue: summary.overdueCount,
              expiring: summary.expiringCount,
            })
          }
        />
      </div>
      <CategoryCard summary={summary} />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/training/sessions/$id', params: { id: row.id } })
        }
        toolbar={
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-44" aria-label={t('common.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UPCOMING}>{t('training.sessions.upcomingOnly')}</SelectItem>
              <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
              {Object.values(TrainingSessionStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`training.sessionStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <TrainingSessionFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(saved) =>
          void navigate({ to: '/training/sessions/$id', params: { id: saved.id } })
        }
      />
    </>
  );
}

/** Training hours of the year per category. */
function CategoryCard({ summary }: { summary: TrainingSummaryDto | undefined }) {
  const { t } = useTranslation();
  if (summary && !summary.byCategory.length) return null;
  const top = summary ? Math.max(...summary.byCategory.map((c) => Number(c.hours)), 1) : 1;
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{t('training.summary.byCategory')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-8 gap-y-3 md:grid-cols-2">
        {!summary && <Skeleton className="h-24 md:col-span-2" />}
        {summary?.byCategory.map((c) => (
          <div key={c.category} className="grid grid-cols-[9rem_1fr_7rem] items-center gap-3">
            <span className="truncate text-sm">{t(`training.categories.${c.category}`)}</span>
            <div className="bg-muted h-3 overflow-hidden rounded">
              <div
                className="bg-primary h-full rounded"
                style={{ width: `${(Number(c.hours) / top) * 100}%` }}
              />
            </div>
            <span className="text-right text-sm tabular-nums">
              {formatHours(c.hours)}
              <span className="text-muted-foreground block text-xs">
                {t('training.summary.participants', { count: c.participants })}
              </span>
            </span>
          </div>
        ))}
        {summary && summary.overdueCount > 0 && (
          <p className="text-muted-foreground text-sm md:col-span-2">
            <Link to="/training/compliance" className="text-primary hover:underline">
              {t('training.summary.overdueLink', { count: summary.overdueCount })}
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
