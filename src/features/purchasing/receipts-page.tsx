import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  goodsReceiptsFindAll,
  useGoodsReceiptsFindAll,
} from '@/api/generated/endpoints/purchasing/purchasing';
import type { GoodsReceiptDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';

export function ReceiptsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const params = table.params;
  const { data, isLoading } = useGoodsReceiptsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<GoodsReceiptDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'receiptDate',
        header: t('purchasing.receipts.date'),
        cell: ({ row }) => formatDate(row.original.receiptDate),
      },
      {
        id: 'partner',
        header: t('purchasing.supplier'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'order',
        header: t('purchasing.orders.single'),
        enableSorting: false,
        cell: ({ row }) => <code className="text-xs">{row.original.orderNumber}</code>,
      },
      {
        id: 'warehouse',
        header: t('purchasing.orders.warehouse'),
        enableSorting: false,
        cell: ({ row }) => row.original.warehouseName,
      },
      {
        id: 'deliveryNoteNo',
        header: t('purchasing.receipts.deliveryNoteNo'),
        enableSorting: false,
        cell: ({ row }) => row.original.deliveryNoteNo ?? '—',
      },
      {
        id: 'movement',
        header: t('purchasing.receipts.movement'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.stockMovementNumber ? (
            <code className="text-xs">{row.original.stockMovementNumber}</code>
          ) : (
            '—'
          ),
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      goodsReceiptsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'goods-receipts',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('purchasing.receipts.date'), value: (r) => new Date(r.receiptDate) },
        { header: t('purchasing.supplier'), value: (r) => r.partnerTitle },
        { header: t('purchasing.orders.single'), value: (r) => r.orderNumber },
        { header: t('purchasing.orders.warehouse'), value: (r) => r.warehouseName },
        { header: t('purchasing.receipts.deliveryNoteNo'), value: (r) => r.deliveryNoteNo },
        { header: t('purchasing.receipts.movement'), value: (r) => r.stockMovementNumber },
        { header: t('purchasing.orders.createdBy'), value: (r) => r.createdByName },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('purchasing.receipts.title')}
        description={t('purchasing.receipts.subtitle')}
        actions={
          <Can permission="purchasing:receive">
            <Button asChild>
              <Link to="/purchasing/receipts/new">
                <Plus /> {t('purchasing.receipts.new')}
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
          void navigate({ to: '/purchasing/receipts/$id', params: { id: row.id } })
        }
      />
    </>
  );
}
