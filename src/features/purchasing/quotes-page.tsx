import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  supplierQuotesFindAll,
  useSupplierQuotesFindAll,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { SupplierQuoteStatus, type SupplierQuoteDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { QuoteStatusBadge } from './purchasing-components';

const ALL = 'ALL';

export function QuotesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as SupplierQuoteStatus),
  };
  const { data, isLoading } = useSupplierQuotesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<SupplierQuoteDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'quoteDate',
        header: t('trade.date'),
        cell: ({ row }) => formatDate(row.original.quoteDate),
      },
      {
        id: 'partner',
        header: t('purchasing.supplier'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'request',
        header: t('purchasing.requests.single'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.requestNumber ? (
            <code className="text-xs">{row.original.requestNumber}</code>
          ) : (
            '—'
          ),
      },
      {
        id: 'validUntil',
        header: t('purchasing.quotes.validUntil'),
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.validUntil),
      },
      {
        id: 'grandTotal',
        header: t('trade.grandTotal'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.grandTotal, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <QuoteStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      supplierQuotesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'supplier-quotes',
      [
        { header: t('trade.number'), value: (q) => q.number },
        { header: t('trade.date'), value: (q) => new Date(q.quoteDate) },
        { header: t('purchasing.supplier'), value: (q) => q.partnerTitle },
        { header: t('purchasing.requests.single'), value: (q) => q.requestNumber },
        {
          header: t('purchasing.quotes.validUntil'),
          value: (q) => (q.validUntil ? new Date(q.validUntil) : null),
        },
        { header: t('trade.currency'), value: (q) => q.currencyCode },
        { header: t('trade.grandTotal'), value: (q) => Number(q.grandTotal) },
        { header: t('trade.grandTotalBase'), value: (q) => Number(q.grandTotalBase) },
        { header: t('common.status'), value: (q) => t(`purchasing.quoteStatus.${q.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('purchasing.quotes.title')}
        description={t('purchasing.quotes.subtitle')}
        actions={
          <Can permission="purchasing:create">
            <Button asChild>
              <Link to="/purchasing/quotes/new">
                <Plus /> {t('purchasing.quotes.new')}
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
          void navigate({ to: '/purchasing/quotes/$id', params: { id: row.id } })
        }
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
              {Object.values(SupplierQuoteStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`purchasing.quoteStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}
