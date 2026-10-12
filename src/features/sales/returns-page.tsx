import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { salesReturnsFindAll, useSalesReturnsFindAll } from '@/api/generated/endpoints/sales/sales';
import type { SalesReturnDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';

export function SalesReturnsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const params = table.params;
  const { data, isLoading } = useSalesReturnsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<SalesReturnDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'returnDate',
        header: t('sales.returns.date'),
        cell: ({ row }) => formatDate(row.original.returnDate),
      },
      {
        id: 'partner',
        header: t('sales.customer'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'invoice',
        header: t('sales.invoices.single'),
        enableSorting: false,
        cell: ({ row }) => <code className="text-xs">{row.original.invoiceNumber}</code>,
      },
      {
        id: 'reason',
        header: t('sales.returns.reason'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-64" title={row.original.reason}>
            {row.original.reason}
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
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      salesReturnsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'sales-returns',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('sales.returns.date'), value: (r) => new Date(r.returnDate) },
        { header: t('sales.customer'), value: (r) => r.partnerTitle },
        { header: t('sales.invoices.single'), value: (r) => r.invoiceNumber },
        { header: t('sales.returns.warehouse'), value: (r) => r.warehouseName },
        { header: t('sales.returns.reason'), value: (r) => r.reason },
        { header: t('trade.currency'), value: (r) => r.currencyCode },
        { header: t('trade.grandTotal'), value: (r) => Number(r.grandTotal) },
        { header: t('trade.grandTotalBase'), value: (r) => Number(r.grandTotalBase) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('sales.returns.title')}
        description={t('sales.returns.subtitle')}
        actions={
          <Can permission="sales:deliver">
            <Button asChild>
              <Link to="/sales/returns/new">
                <Plus /> {t('sales.returns.new')}
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
        onRowClick={(row) => void navigate({ to: '/sales/returns/$id', params: { id: row.id } })}
      />
    </>
  );
}
