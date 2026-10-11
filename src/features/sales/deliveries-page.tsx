import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  deliveryNotesFindAll,
  useDeliveryNotesFindAll,
} from '@/api/generated/endpoints/sales/sales';
import type { DeliveryNoteDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';

export function DeliveriesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const params = table.params;
  const { data, isLoading } = useDeliveryNotesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<DeliveryNoteDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'deliveryDate',
        header: t('sales.deliveries.date'),
        cell: ({ row }) => formatDate(row.original.deliveryDate),
      },
      {
        id: 'partner',
        header: t('sales.customer'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'order',
        header: t('sales.orders.single'),
        enableSorting: false,
        cell: ({ row }) => <code className="text-xs">{row.original.orderNumber}</code>,
      },
      {
        id: 'warehouse',
        header: t('sales.orders.warehouse'),
        enableSorting: false,
        cell: ({ row }) => row.original.warehouseName,
      },
      {
        id: 'carrier',
        header: t('sales.deliveries.carrier'),
        enableSorting: false,
        cell: ({ row }) => row.original.carrier,
      },
      {
        id: 'lineCount',
        header: t('trade.lines'),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.lineCount}</span>,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      deliveryNotesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'delivery-notes',
      [
        { header: t('trade.number'), value: (d) => d.number },
        { header: t('sales.deliveries.date'), value: (d) => new Date(d.deliveryDate) },
        { header: t('sales.customer'), value: (d) => d.partnerTitle },
        { header: t('sales.orders.single'), value: (d) => d.orderNumber },
        { header: t('sales.orders.warehouse'), value: (d) => d.warehouseName },
        { header: t('sales.deliveries.carrier'), value: (d) => d.carrier },
        { header: t('sales.deliveries.movement'), value: (d) => d.stockMovementNumber },
        { header: t('trade.lines'), value: (d) => d.lineCount },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('sales.deliveries.title')}
        description={t('sales.deliveries.subtitle')}
        actions={
          <Can permission="sales:deliver">
            <Button asChild>
              <Link to="/sales/deliveries/new">
                <Plus /> {t('sales.deliveries.new')}
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
        onRowClick={(row) => void navigate({ to: '/sales/deliveries/$id', params: { id: row.id } })}
      />
    </>
  );
}
