import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  jobApplicationsFindAll,
  useJobApplicationsFindAll,
  useJobPostingsFindAll,
} from '@/api/generated/endpoints/recruitment/recruitment';
import {
  ApplicationStage,
  type JobApplicationDto,
  type JobApplicationsFindAllParams,
} from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ApplicationStageBadge, OfferStatusBadge, Rating } from './recruitment-components';

const ACTIVE = '__active__';
const ALL = '__all__';

export function ApplicationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState();
  const [stage, setStage] = useState(ACTIVE);
  const [postingId, setPostingId] = useState(ALL);
  const { data: postings } = useJobPostingsFindAll({
    pageSize: 100,
    sortBy: 'number',
    sortOrder: 'desc',
  });
  const params: JobApplicationsFindAllParams = {
    ...table.params,
    stage: stage === ACTIVE || stage === ALL ? undefined : (stage as ApplicationStage),
    active: stage === ACTIVE ? 'true' : undefined,
    postingId: postingId === ALL ? undefined : postingId,
  };
  const { data, isLoading } = useJobApplicationsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<JobApplicationDto, unknown>[]>(
    () => [
      {
        id: 'candidate',
        header: t('recruitment.candidate'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.candidateName}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.candidateTitle ?? row.original.candidateEmail}
            </span>
          </span>
        ),
      },
      {
        id: 'posting',
        header: t('recruitment.posting'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            {row.original.postingTitle}
            <code className="text-muted-foreground block text-xs">
              {row.original.postingNumber}
            </code>
          </span>
        ),
      },
      {
        id: 'source',
        header: t('recruitment.candidates.source'),
        enableSorting: false,
        cell: ({ row }) => t(`recruitment.sources.${row.original.source}`),
      },
      {
        id: 'rating',
        header: t('recruitment.applications.rating'),
        cell: ({ row }) => <Rating value={row.original.rating ?? row.original.averageRating} />,
      },
      {
        id: 'appliedAt',
        header: t('recruitment.applications.appliedAt'),
        cell: ({ row }) => formatDate(row.original.appliedAt),
      },
      {
        id: 'nextInterview',
        header: t('recruitment.applications.nextInterview'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.nextInterviewAt ? formatDateTime(row.original.nextInterviewAt) : '—',
      },
      {
        id: 'stageChangedAt',
        header: t('recruitment.applications.stage'),
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap items-center gap-1">
            <ApplicationStageBadge stage={row.original.stage} />
            {row.original.offerStatus && row.original.stage === 'OFFER' && (
              <OfferStatusBadge status={row.original.offerStatus} />
            )}
            <span className="text-muted-foreground block w-full text-xs">
              {t('recruitment.applications.daysInStage', { count: row.original.daysInStage })}
            </span>
          </span>
        ),
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      jobApplicationsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'job-applications',
      [
        { header: t('recruitment.candidate'), value: (r) => r.candidateName },
        { header: t('common.email'), value: (r) => r.candidateEmail },
        { header: t('trade.number'), value: (r) => r.postingNumber },
        { header: t('recruitment.posting'), value: (r) => r.postingTitle },
        {
          header: t('recruitment.candidates.source'),
          value: (r) => t(`recruitment.sources.${r.source}`),
        },
        { header: t('recruitment.applications.rating'), value: (r) => r.rating },
        { header: t('recruitment.applications.appliedAt'), value: (r) => new Date(r.appliedAt) },
        {
          header: t('recruitment.applications.stage'),
          value: (r) => t(`recruitment.stages.${r.stage}`),
        },
        { header: t('recruitment.applications.daysInStageShort'), value: (r) => r.daysInStage },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('recruitment.applications.title')}
        description={t('recruitment.applications.subtitle')}
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/recruitment/applications/$id', params: { id: row.id } })
        }
        toolbar={
          <>
            <Select
              value={stage}
              onValueChange={(value) => {
                setStage(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44" aria-label={t('recruitment.applications.stage')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ACTIVE}>{t('recruitment.applications.inPipeline')}</SelectItem>
                <SelectItem value={ALL}>{t('recruitment.applications.allStages')}</SelectItem>
                {Object.values(ApplicationStage).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`recruitment.stages.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={postingId}
              onValueChange={(value) => {
                setPostingId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-64" aria-label={t('recruitment.posting')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('recruitment.applications.allPostings')}</SelectItem>
                {(postings?.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.number} · {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </>
  );
}
