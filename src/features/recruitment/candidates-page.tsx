import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Paperclip, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  candidatesFindAll,
  useCandidatesFindAll,
} from '@/api/generated/endpoints/recruitment/recruitment';
import {
  CandidateSource,
  type CandidateDto,
  type CandidatesFindAllParams,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { CandidateFormDialog } from './candidate-form-dialog';

const ALL = '__all__';

export function CandidatesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = useBaseCurrency();
  const table = useTableState();
  const [source, setSource] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const params: CandidatesFindAllParams = {
    ...table.params,
    source: source === ALL ? undefined : (source as CandidateSource),
  };
  const { data, isLoading } = useCandidatesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<CandidateDto, unknown>[]>(
    () => [
      {
        id: 'firstName',
        header: t('recruitment.candidate'),
        cell: ({ row }) => (
          <span>
            <span className="inline-flex items-center gap-1 font-medium">
              {row.original.fullName}
              {row.original.hasCv && (
                <Paperclip
                  className="text-muted-foreground size-3.5"
                  aria-label={t('recruitment.candidates.cv')}
                />
              )}
            </span>
            <span className="text-muted-foreground block text-xs">{row.original.email}</span>
          </span>
        ),
      },
      {
        id: 'currentTitle',
        header: t('recruitment.candidates.currentTitle'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            {row.original.currentTitle ?? '—'}
            {row.original.currentCompany && (
              <span className="text-muted-foreground block text-xs">
                {row.original.currentCompany}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'city',
        header: t('common.city'),
        enableSorting: false,
        cell: ({ row }) => row.original.city ?? '—',
      },
      {
        id: 'source',
        header: t('recruitment.candidates.source'),
        enableSorting: false,
        cell: ({ row }) => t(`recruitment.sources.${row.original.source}`),
      },
      {
        id: 'expectedSalary',
        header: t('recruitment.candidates.expectedSalary'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.expectedSalary ? formatMoney(row.original.expectedSalary, currency) : '—'}
          </span>
        ),
      },
      {
        id: 'applications',
        header: t('recruitment.candidates.applications'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.applicationCount}
            {row.original.activeApplicationCount > 0 && (
              <span className="text-muted-foreground text-xs">
                {' '}
                (
                {t('recruitment.candidates.activeCount', {
                  count: row.original.activeApplicationCount,
                })}
                )
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: t('recruitment.candidates.addedAt'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
    ],
    [t, currency],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      candidatesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'candidates',
      [
        { header: t('recruitment.candidates.firstName'), value: (r) => r.firstName },
        { header: t('recruitment.candidates.lastName'), value: (r) => r.lastName },
        { header: t('common.email'), value: (r) => r.email },
        { header: t('common.phone'), value: (r) => r.phone },
        { header: t('common.city'), value: (r) => r.city },
        { header: t('recruitment.candidates.currentTitle'), value: (r) => r.currentTitle },
        { header: t('recruitment.candidates.currentCompany'), value: (r) => r.currentCompany },
        {
          header: t('recruitment.candidates.source'),
          value: (r) => t(`recruitment.sources.${r.source}`),
        },
        {
          header: t('recruitment.candidates.expectedSalary'),
          value: (r) => (r.expectedSalary ? Number(r.expectedSalary) : null),
        },
        { header: t('recruitment.candidates.applications'), value: (r) => r.applicationCount },
        { header: t('recruitment.candidates.addedAt'), value: (r) => new Date(r.createdAt) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('recruitment.candidates.title')}
        description={t('recruitment.candidates.subtitle')}
        actions={
          <Can permission="recruitment:create">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('recruitment.candidates.new')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/recruitment/candidates/$id', params: { id: row.id } })
        }
        toolbar={
          <Select
            value={source}
            onValueChange={(value) => {
              setSource(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-44" aria-label={t('recruitment.candidates.source')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('recruitment.candidates.allSources')}</SelectItem>
              {Object.values(CandidateSource).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`recruitment.sources.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <CandidateFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(saved) =>
          void navigate({ to: '/recruitment/candidates/$id', params: { id: saved.id } })
        }
      />
    </>
  );
}
