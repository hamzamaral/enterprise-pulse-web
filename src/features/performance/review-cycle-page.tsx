import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CheckCircle2, Lock, Pencil, Rocket, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useReviewCyclesClose,
  useReviewCyclesFindOne,
  useReviewCyclesLaunch,
  useReviewCyclesRemove,
  useReviewCyclesReviews,
} from '@/api/generated/endpoints/performance/performance';
import {
  PerformanceReviewStatus,
  type PerformanceReviewDto,
  type ReviewCycleDetailDto,
} from '@/api/generated/model';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import {
  CycleStatusBadge,
  percent,
  ProgressBar,
  ReviewStatusBadge,
  SCORE_BANDS,
  ScoreBadge,
  formatScore,
  useInvalidatePerformance,
} from './performance-components';
import { ReviewCycleFormDialog } from './review-cycle-form-dialog';

const ALL = '__all__';
const NO_DEPARTMENT = '__none__';

export function ReviewCyclePage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidatePerformance();
  const [editing, setEditing] = useState(false);
  const { data: cycle, isLoading } = useReviewCyclesFindOne(id);
  const launch = useReviewCyclesLaunch();
  const close = useReviewCyclesClose();
  const remove = useReviewCyclesRemove();

  if (!cycle) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const onLaunch = () =>
    launch.mutate(
      { id },
      {
        onSuccess: async (saved) => {
          toast.success(t('performance.cycles.launched', { count: saved.reviewCount }));
          await invalidate();
        },
      },
    );

  const onClose = () =>
    close.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('performance.cycles.closed'));
          await invalidate();
        },
      },
    );

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('performance.cycles.deleted'));
          await navigate({ to: '/performance' });
          await invalidate();
        },
      },
    );

  const pendingCount = cycle.statusCounts.SELF_REVIEW + cycle.statusCounts.MANAGER_REVIEW;

  return (
    <>
      <Link
        to="/performance"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('performance.cycles.title')}
      </Link>
      <PageHeader
        title={cycle.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)}
            <CycleStatusBadge status={cycle.status} />
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {cycle.canLaunch && (
              <ConfirmDialog
                trigger={
                  <Button disabled={launch.isPending}>
                    <Rocket /> {t('performance.cycles.launch')}
                  </Button>
                }
                title={t('performance.cycles.launchTitle')}
                description={t('performance.cycles.launchDescription')}
                confirmLabel={t('performance.cycles.launch')}
                onConfirm={onLaunch}
              />
            )}
            {cycle.canClose && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={close.isPending}>
                    <Lock /> {t('performance.cycles.close')}
                  </Button>
                }
                title={t('performance.cycles.closeTitle')}
                description={
                  pendingCount
                    ? t('performance.cycles.closePending', { count: pendingCount })
                    : t('performance.cycles.closeDescription')
                }
                confirmLabel={t('performance.cycles.close')}
                onConfirm={onClose}
              />
            )}
            {cycle.canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {cycle.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={onDelete}
              />
            )}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('performance.cycles.selfReviewDue')}>
                {formatDate(cycle.selfReviewDue)}
              </Field>
              <Field label={t('performance.cycles.managerReviewDue')}>
                {formatDate(cycle.managerReviewDue)}
              </Field>
              <Field label={t('performance.cycles.weighting')}>
                {t('performance.cycles.weightSplit', {
                  goals: cycle.goalWeight,
                  competencies: 100 - cycle.goalWeight,
                })}
              </Field>
              <Field label={t('performance.cycles.launchedAt')}>
                {formatDateTime(cycle.launchedAt)}
              </Field>
              <Field label={t('performance.cycles.closedAt')}>
                {formatDateTime(cycle.closedAt)}
              </Field>
              <Field label={t('common.createdBy')}>{cycle.createdByName}</Field>
              <div className="sm:col-span-3">
                <dt className="text-muted-foreground mb-1 text-xs">
                  {t('performance.cycles.competencies')}
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {cycle.competencies.length ? (
                    cycle.competencies.map((c) => (
                      <Badge key={c.id} variant="secondary" title={c.description ?? undefined}>
                        {c.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <ProgressCard cycle={cycle} />
      </div>

      {cycle.status !== 'DRAFT' && (
        <>
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <DistributionCard cycle={cycle} />
            <DepartmentsCard cycle={cycle} />
          </div>
          <ReviewsTable cycle={cycle} />
        </>
      )}

      <ReviewCycleFormDialog open={editing} onOpenChange={setEditing} cycle={cycle} />
    </>
  );
}

function ProgressCard({ cycle }: { cycle: ReviewCycleDetailDto }) {
  const { t } = useTranslation();
  const total = cycle.reviewCount;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('performance.cycles.progress')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cycle.status === 'DRAFT' ? (
          <p className="text-muted-foreground text-sm">{t('performance.cycles.draftHint')}</p>
        ) : (
          <>
            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular-nums">
                  %{percent(cycle.completedCount, total)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t('performance.cycles.completedOf', {
                    done: cycle.completedCount,
                    total,
                  })}
                </span>
              </div>
              <ProgressBar value={percent(cycle.completedCount, total)} className="w-full" />
            </div>
            <ul className="space-y-2 text-sm">
              {Object.values(PerformanceReviewStatus).map((status) => (
                <li key={status} className="flex items-center justify-between">
                  <ReviewStatusBadge status={status} />
                  <span className="tabular-nums">{cycle.statusCounts[status]}</span>
                </li>
              ))}
              <li className="flex items-center justify-between border-t pt-2">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <CheckCircle2 className="size-4" /> {t('performance.reviews.acknowledged')}
                </span>
                <span className="tabular-nums">
                  {cycle.acknowledgedCount} / {cycle.completedCount}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">{t('performance.averageScore')}</span>
                <ScoreBadge score={cycle.averageScore} />
              </li>
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DistributionCard({ cycle }: { cycle: ReviewCycleDetailDto }) {
  const { t } = useTranslation();
  const top = Math.max(...cycle.distribution, 1);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('performance.cycles.distribution')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {SCORE_BANDS.map((band) => {
          const count = cycle.distribution[band - 1] ?? 0;
          return (
            <div key={band} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
              <span className="truncate">
                <span className="text-muted-foreground mr-1 tabular-nums">{band}</span>
                {t(`performance.bands.${band}`)}
              </span>
              <div className="bg-muted h-3 overflow-hidden rounded">
                <div
                  className="bg-primary h-full rounded"
                  style={{ width: `${(count / top) * 100}%` }}
                />
              </div>
              <span className="text-right tabular-nums">
                {count}
                <span className="text-muted-foreground ml-1 text-xs">
                  %{percent(count, cycle.completedCount)}
                </span>
              </span>
            </div>
          );
        })}
        {!cycle.completedCount && (
          <p className="text-muted-foreground text-sm">{t('performance.cycles.noCompleted')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function DepartmentsCard({ cycle }: { cycle: ReviewCycleDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('performance.cycles.byDepartment')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('employees.department')}</TableHead>
              <TableHead>{t('performance.cycles.progress')}</TableHead>
              <TableHead className="text-right">{t('performance.averageScore')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cycle.departments.map((d) => (
              <TableRow key={d.departmentId ?? NO_DEPARTMENT}>
                <TableCell>{d.departmentName ?? t('performance.cycles.noDepartment')}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <ProgressBar value={percent(d.completedCount, d.reviewCount)} />
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {d.completedCount} / {d.reviewCount}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatScore(d.averageScore)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReviewsTable({ cycle }: { cycle: ReviewCycleDetailDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState(ALL);
  const [department, setDepartment] = useState(ALL);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useReviewCyclesReviews(cycle.id, {
    status: status === ALL ? undefined : (status as PerformanceReviewStatus),
    departmentId: department === ALL ? undefined : department,
  });

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    if (!term) return data;
    return data?.filter((r) =>
      [r.employeeName, r.employeeNo, r.reviewerName ?? ''].some((v) =>
        v.toLocaleLowerCase('tr').includes(term),
      ),
    );
  }, [data, search]);

  const columns = useMemo<ColumnDef<PerformanceReviewDto, unknown>[]>(
    () => [
      {
        id: 'employee',
        header: t('employees.employee'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.employeeName}</span>
            <code className="text-muted-foreground block text-xs">{row.original.employeeNo}</code>
          </span>
        ),
      },
      {
        id: 'department',
        header: t('employees.department'),
        cell: ({ row }) => (
          <span>
            {row.original.departmentName ?? '—'}
            {row.original.positionName && (
              <span className="text-muted-foreground block text-xs">
                {row.original.positionName}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'reviewer',
        header: t('performance.reviews.reviewer'),
        cell: ({ row }) => row.original.reviewerName ?? '—',
      },
      {
        id: 'goals',
        header: t('performance.reviews.goals'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.goalCount}</span>,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1">
            <ReviewStatusBadge status={row.original.status} />
            {row.original.acknowledgedAt && (
              <CheckCircle2
                className="size-4 text-emerald-600"
                aria-label={t('performance.reviews.acknowledged')}
              />
            )}
          </span>
        ),
      },
      {
        id: 'score',
        header: t('performance.reviews.overallScore'),
        cell: ({ row }) => <ScoreBadge score={row.original.overallScore} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    await exportTable(
      format,
      'performance-reviews',
      [
        { header: t('employees.employeeNo'), value: (r) => r.employeeNo },
        { header: t('employees.employee'), value: (r) => r.employeeName },
        { header: t('employees.department'), value: (r) => r.departmentName },
        { header: t('employees.position'), value: (r) => r.positionName },
        { header: t('performance.reviews.reviewer'), value: (r) => r.reviewerName },
        { header: t('performance.reviews.goals'), value: (r) => r.goalCount },
        { header: t('common.status'), value: (r) => t(`performance.reviewStatus.${r.status}`) },
        {
          header: t('performance.reviews.overallScore'),
          value: (r) => (r.overallScore === null ? null : Number(r.overallScore)),
        },
        {
          header: t('performance.reviews.selfSubmittedAt'),
          value: (r) => (r.selfSubmittedAt ? new Date(r.selfSubmittedAt) : null),
        },
        {
          header: t('performance.reviews.managerSubmittedAt'),
          value: (r) => (r.managerSubmittedAt ? new Date(r.managerSubmittedAt) : null),
        },
        {
          header: t('performance.reviews.acknowledged'),
          value: (r) => (r.acknowledgedAt ? new Date(r.acknowledgedAt) : null),
        },
      ],
      rows ?? [],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('performance.cycles.reviews')}</CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={rows}
          isLoading={isLoading}
          searchable={false}
          onExport={handleExport}
          onRowClick={(row) =>
            void navigate({ to: '/performance/reviews/$id', params: { id: row.id } })
          }
          toolbar={
            <>
              <div className="relative w-full max-w-xs">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="pl-8"
                />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-44" aria-label={t('common.status')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
                  {Object.values(PerformanceReviewStatus).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`performance.reviewStatus.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-48" aria-label={t('employees.department')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('performance.cycles.allDepartments')}</SelectItem>
                  {cycle.departments.flatMap((d) =>
                    d.departmentId
                      ? [
                          <SelectItem key={d.departmentId} value={d.departmentId}>
                            {d.departmentName}
                          </SelectItem>,
                        ]
                      : [],
                  )}
                </SelectContent>
              </Select>
            </>
          }
        />
      </CardContent>
    </Card>
  );
}
