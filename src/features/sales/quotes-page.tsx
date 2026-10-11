import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { salesQuotesFindAll, useSalesQuotesFindAll } from '@/api/generated/endpoints/sales/sales';
import { SalesQuoteStatus, type SalesQuoteDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { SalesQuoteStatusBadge } from './sales-components';

const ALL = 'ALL';

export function SalesQuotesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as SalesQuoteStatus),
  };
  const { data, isLoading } = useSalesQuotesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<SalesQuoteDto, unknown>[]>(
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
        header: t('sales.customer'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'validUntil',
        header: t('sales.quotes.validUntil'),
        cell: ({ row }) => (
          <span
            className={cn(
              row.original.expired && row.original.status === 'OPEN' && 'text-destructive',
            )}
          >
            {formatDate(row.original.validUntil)}
          </span>
        ),
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
        id: 'order',
        header: t('sales.orders.single'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.orderNumber ? (
            <code className="text-xs">{row.original.orderNumber}</code>
          ) : null,
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (
          <SalesQuoteStatusBadge status={row.original.status} expired={row.original.expired} />
        ),
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      salesQuotesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'sales-quotes',
      [
        { header: t('trade.number'), value: (q) => q.number },
        { header: t('trade.date'), value: (q) => new Date(q.quoteDate) },
        { header: t('sales.customer'), value: (q) => q.partnerTitle },
        {
          header: t('sales.quotes.validUntil'),
          value: (q) => (q.validUntil ? new Date(q.validUntil) : null),
        },
        { header: t('trade.currency'), value: (q) => q.currencyCode },
        { header: t('trade.grandTotal'), value: (q) => Number(q.grandTotal) },
        { header: t('trade.grandTotalBase'), value: (q) => Number(q.grandTotalBase) },
        { header: t('sales.orders.single'), value: (q) => q.orderNumber },
        { header: t('common.status'), value: (q) => t(`sales.quoteStatus.${q.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('sales.quotes.title')}
        description={t('sales.quotes.subtitle')}
        actions={
          <Can permission="sales:create">
            <Button asChild>
              <Link to="/sales/quotes/new">
                <Plus /> {t('sales.quotes.new')}
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
        onRowClick={(row) => void navigate({ to: '/sales/quotes/$id', params: { id: row.id } })}
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
              {Object.values(SalesQuoteStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`sales.quoteStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}
