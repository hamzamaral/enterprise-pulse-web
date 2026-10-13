import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  jobPostingsFindAll,
  useJobPostingsFindAll,
  useJobPostingsSummary,
} from '@/api/generated/endpoints/recruitment/recruitment';
import {
  JobPostingStatus,
  type JobPostingDto,
  type JobPostingsFindAllParams,
  type RecruitmentSummaryDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { JobPostingFormDialog } from './job-posting-form-dialog';
import { ACTIVE_STAGES, PostingStatusBadge, salaryRange } from './recruitment-components';

const ACTIVE = '__active__';
const ALL = '__all__';

export function JobPostingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState();
  const [status, setStatus] = useState(ACTIVE);
  const [creating, setCreating] = useState(false);
  const { data: summary } = useJobPostingsSummary();
  const params: JobPostingsFindAllParams = {
    ...table.params,
    status: status === ACTIVE || status === ALL ? undefined : (status as JobPostingStatus),
    active: status === ACTIVE ? 'true' : undefined,
  };
  const { data, isLoading } = useJobPostingsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<JobPostingDto, unknown>[]>(
    () => [
      {
        id: 'title',
        header: t('recruitment.postings.titleField'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.title}</span>
            <code className="text-muted-foreground block text-xs">{row.original.number}</code>
          </span>
        ),
      },
      {
        id: 'department',
        header: t('employees.department'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            {row.original.departmentName ?? '—'}
            {row.original.location && (
              <span className="text-muted-foreground block text-xs">{row.original.location}</span>
            )}
          </span>
        ),
      },
      {
        id: 'hiringManager',
        header: t('recruitment.postings.hiringManager'),
        enableSorting: false,
        cell: ({ row }) => row.original.hiringManagerName ?? '—',
      },
      {
        id: 'pipeline',
        header: t('recruitment.postings.pipeline'),
        enableSorting: false,
        cell: ({ row }) => <StageStrip counts={row.original.stageCounts} />,
      },
      {
        id: 'openings',
        header: t('recruitment.postings.hired'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.hiredCount} / {row.original.openings}
          </span>
        ),
      },
      {
        id: 'closesAt',
        header: t('recruitment.postings.closesAt'),
        cell: ({ row }) => formatDate(row.original.closesAt),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <PostingStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      jobPostingsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'job-postings',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('recruitment.postings.titleField'), value: (r) => r.title },
        { header: t('employees.department'), value: (r) => r.departmentName },
        { header: t('employees.position'), value: (r) => r.positionName },
        { header: t('recruitment.postings.hiringManager'), value: (r) => r.hiringManagerName },
        { header: t('recruitment.postings.openings'), value: (r) => r.openings },
        { header: t('recruitment.postings.applications'), value: (r) => r.applicationCount },
        { header: t('recruitment.postings.active'), value: (r) => r.activeCount },
        { header: t('recruitment.postings.hired'), value: (r) => r.hiredCount },
        {
          header: t('recruitment.postings.salary'),
          value: (r) => salaryRange(r.salaryMin, r.salaryMax, r.currencyCode),
        },
        {
          header: t('recruitment.postings.publishedAt'),
          value: (r) => (r.publishedAt ? new Date(r.publishedAt) : null),
        },
        {
          header: t('recruitment.postings.closesAt'),
          value: (r) => (r.closesAt ? new Date(r.closesAt) : null),
        },
        { header: t('common.status'), value: (r) => t(`recruitment.postingStatus.${r.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('recruitment.postings.title')}
        description={t('recruitment.postings.subtitle')}
        actions={
          <Can permission="recruitment:create">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('recruitment.postings.new')}
            </Button>
          </Can>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('recruitment.summary.openPostings')}
          value={summary?.openPostings}
          hint={summary && t('recruitment.summary.openPositions', { count: summary.openPositions })}
        />
        <KpiCard
          label={t('recruitment.summary.activeApplications')}
          value={summary?.activeApplications}
          hint={
            summary && t('recruitment.summary.newApplications', { count: summary.newApplications })
          }
        />
        <KpiCard
          label={t('recruitment.summary.interviewsThisWeek')}
          value={summary?.interviewsThisWeek}
          hint={summary && t('recruitment.summary.pendingOffers', { count: summary.pendingOffers })}
        />
        <KpiCard
          label={t('recruitment.summary.hiresThisYear')}
          value={summary?.hiresThisYear}
          hint={
            summary &&
            (summary.averageDaysToHire === null
              ? t('recruitment.summary.noHires')
              : t('recruitment.summary.averageDays', { count: summary.averageDaysToHire }))
          }
        />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <FunnelCard summary={summary} />
        <UpcomingCard summary={summary} />
      </div>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/recruitment/$id', params: { id: row.id } })}
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-44" aria-label={t('common.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVE}>{t('recruitment.postings.activeOnly')}</SelectItem>
              <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
              {Object.values(JobPostingStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`recruitment.postingStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <JobPostingFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(saved) => void navigate({ to: '/recruitment/$id', params: { id: saved.id } })}
      />
    </>
  );
}

/** Applications per active stage as small counters. */
function StageStrip({ counts }: { counts: JobPostingDto['stageCounts'] }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex gap-1">
      {ACTIVE_STAGES.map((stage) => (
        <span
          key={stage}
          title={t(`recruitment.stages.${stage}`)}
          className={
            counts[stage]
              ? 'bg-primary/10 text-primary min-w-7 rounded px-1.5 py-0.5 text-center text-xs tabular-nums'
              : 'bg-muted text-muted-foreground min-w-7 rounded px-1.5 py-0.5 text-center text-xs tabular-nums'
          }
        >
          {counts[stage]}
        </span>
      ))}
    </span>
  );
}

function FunnelCard({ summary }: { summary: RecruitmentSummaryDto | undefined }) {
  const { t } = useTranslation();
  const stages = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED'] as const;
  const top = summary ? Math.max(summary.funnel.APPLIED, 1) : 1;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recruitment.summary.funnel')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {summary
          ? stages.map((stage) => {
              const count = summary.funnel[stage];
              return (
                <div key={stage} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-2">
                  <span className="text-muted-foreground text-sm">
                    {t(`recruitment.stages.${stage}`)}
                  </span>
                  <div className="bg-muted h-2.5 overflow-hidden rounded-full">
                    <div
                      className={
                        stage === 'HIRED'
                          ? 'h-full rounded-full bg-emerald-500'
                          : 'bg-primary h-full rounded-full'
                      }
                      style={{ width: `${(count / top) * 100}%` }}
                    />
                  </div>
                  <span className="text-right text-sm font-medium tabular-nums">{count}</span>
                </div>
              );
            })
          : stages.map((stage) => <Skeleton key={stage} className="h-5" />)}
        {summary && summary.bySource.length > 0 && (
          <p className="text-muted-foreground pt-2 text-xs">
            {t('recruitment.summary.topSources')}:{' '}
            {summary.bySource
              .slice(0, 3)
              .map((s) => `${t(`recruitment.sources.${s.source}`)} (${s.applications})`)
              .join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function UpcomingCard({ summary }: { summary: RecruitmentSummaryDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recruitment.summary.upcomingInterviews')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <Skeleton className="h-40" />
        ) : summary.upcomingInterviews.length ? (
          <ul className="divide-y">
            {summary.upcomingInterviews.map((interview) => (
              <li key={interview.id} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
                <CalendarClock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <Link
                    to="/recruitment/applications/$id"
                    params={{ id: interview.applicationId }}
                    className="font-medium hover:underline"
                  >
                    {interview.candidateName}
                  </Link>
                  <div className="text-muted-foreground truncate text-xs">
                    {interview.postingTitle} · {t(`recruitment.interviewTypes.${interview.type}`)}
                    {interview.interviewerNames.length > 0 &&
                      ` · ${interview.interviewerNames.join(', ')}`}
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {formatDateTime(interview.scheduledAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t('recruitment.summary.noUpcoming')}</p>
        )}
      </CardContent>
    </Card>
  );
}
