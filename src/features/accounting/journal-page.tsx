import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  journalEntriesFindAll,
  useJournalEntriesFindAll,
} from '@/api/generated/endpoints/accounting/accounting';
import {
  JournalEntryStatus,
  JournalSource,
  type JournalEntriesFindAllParams,
  type JournalEntryDto,
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
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { directDocumentId, JournalStatusBadge, SourceDocumentLink } from './accounting-components';

const ALL = '__all__';

/** Yevmiye defteri: every journal entry, manual or generated from a document. */
export function JournalPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = useBaseCurrency();
  const table = useTableState({ sort: [{ id: 'entryDate', desc: true }] });
  const [source, setSource] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params: JournalEntriesFindAllParams = {
    ...table.params,
    source: source === ALL ? undefined : (source as JournalSource),
    status: status === ALL ? undefined : (status as JournalEntryStatus),
    from: from || undefined,
    to: to || undefined,
  };
  const { data, isLoading } = useJournalEntriesFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<JournalEntryDto, unknown>[]>(
    () => [
      {
        id: 'entryDate',
        header: t('accounting.date'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatDate(row.original.entryDate)}</span>
        ),
      },
      {
        id: 'number',
        header: t('accounting.journal.number'),
        cell: ({ row }) => (
          <Link
            to="/accounting/journal/$id"
            params={{ id: row.original.id }}
            className="font-mono text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'description',
        header: t('accounting.description'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-md">
            <span className="line-clamp-2">{row.original.description}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.createdByName}
            </span>
          </span>
        ),
      },
      {
        id: 'source',
        header: t('accounting.sourceLabel'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block whitespace-nowrap">
            <span className="text-sm">{t(`accounting.source.${row.original.source}`)}</span>
            <span className="block">
              <SourceDocumentLink
                source={row.original.source}
                documentId={directDocumentId(row.original.source, row.original.sourceId)}
                number={row.original.sourceNumber}
              />
            </span>
          </span>
        ),
      },
      {
        id: 'total',
        header: t('accounting.amount'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatMoney(row.original.total, currency)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (
          <JournalStatusBadge
            status={row.original.status}
            reversed={row.original.isReversed}
            reversal={row.original.isReversal}
          />
        ),
      },
    ],
    [t, currency],
  );

  const statusText = (r: JournalEntryDto) =>
    r.status === 'DRAFT'
      ? t('accounting.status.DRAFT')
      : r.isReversed
        ? t('accounting.status.REVERSED')
        : r.isReversal
          ? t('accounting.status.REVERSAL')
          : t('accounting.status.POSTED');

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      journalEntriesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'journal-entries',
      [
        { header: t('accounting.date'), value: (r) => new Date(r.entryDate) },
        { header: t('accounting.journal.number'), value: (r) => r.number },
        { header: t('accounting.description'), value: (r) => r.description },
        { header: t('accounting.sourceLabel'), value: (r) => t(`accounting.source.${r.source}`) },
        { header: t('accounting.document'), value: (r) => r.sourceNumber },
        { header: t('accounting.amount'), value: (r) => Number(r.total) },
        { header: t('common.status'), value: statusText },
        { header: t('common.createdBy'), value: (r) => r.createdByName },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('accounting.journal.title')}
        description={t('accounting.journal.subtitle')}
        actions={
          <Can permission="accounting:update">
            <Button asChild>
              <Link to="/accounting/journal/new">
                <Plus /> {t('accounting.journal.new')}
              </Link>
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
          void navigate({ to: '/accounting/journal/$id', params: { id: row.id } })
        }
        toolbar={
          <>
            <Select
              value={source}
              onValueChange={(value) => {
                setSource(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48" aria-label={t('accounting.sourceLabel')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('accounting.allSources')}</SelectItem>
                {Object.values(JournalSource).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`accounting.source.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-36" aria-label={t('common.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('accounting.allStatuses')}</SelectItem>
                {Object.values(JournalEntryStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`accounting.status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-40"
              aria-label={t('accounting.from')}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPage();
              }}
            />
            <Input
              type="date"
              className="w-40"
              aria-label={t('accounting.to')}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetPage();
              }}
            />
          </>
        }
      />
    </>
  );
}
