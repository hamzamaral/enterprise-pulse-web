import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  purchaseOrdersFindAll,
  usePurchaseOrdersFindAll,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { PurchaseOrderStatus, type PurchaseOrderDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { OrderStatusBadge } from './purchasing-components';

const ALL = 'ALL';

export function ProgressCell({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div className="bg-primary h-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">%{percent}</span>
    </div>
  );
}

export function OrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [open, setOpen] = useState(false);
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as PurchaseOrderStatus),
    open: open || undefined,
  };
  const { data, isLoading } = usePurchaseOrdersFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<PurchaseOrderDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'orderDate',
        header: t('trade.date'),
        cell: ({ row }) => formatDate(row.original.orderDate),
      },
      {
        id: 'partner',
        header: t('purchasing.supplier'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'warehouse',
        header: t('purchasing.orders.warehouse'),
        enableSorting: false,
        cell: ({ row }) => row.original.warehouseName,
      },
      {
        id: 'expectedDate',
        header: t('purchasing.orders.expectedDate'),
        cell: ({ row }) => formatDate(row.original.expectedDate),
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
        id: 'received',
        header: t('purchasing.orders.received'),
        enableSorting: false,
        cell: ({ row }) => <ProgressCell percent={row.original.receivedPercent} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <OrderStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      purchaseOrdersFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'purchase-orders',
      [
        { header: t('trade.number'), value: (o) => o.number },
        { header: t('trade.date'), value: (o) => new Date(o.orderDate) },
        { header: t('purchasing.supplier'), value: (o) => o.partnerTitle },
        { header: t('purchasing.orders.warehouse'), value: (o) => o.warehouseName },
        {
          header: t('purchasing.orders.expectedDate'),
          value: (o) => (o.expectedDate ? new Date(o.expectedDate) : null),
        },
        { header: t('trade.currency'), value: (o) => o.currencyCode },
        { header: t('trade.grandTotal'), value: (o) => Number(o.grandTotal) },
        { header: t('trade.grandTotalBase'), value: (o) => Number(o.grandTotalBase) },
        { header: t('purchasing.orders.received'), value: (o) => o.receivedPercent / 100 },
        { header: t('common.status'), value: (o) => t(`purchasing.orderStatus.${o.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('purchasing.orders.title')}
        description={t('purchasing.orders.subtitle')}
        actions={
          <Can permission="purchasing:create">
            <Button asChild>
              <Link to="/purchasing/orders/new">
                <Plus /> {t('purchasing.orders.new')}
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
          void navigate({ to: '/purchasing/orders/$id', params: { id: row.id } })
        }
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
                {Object.values(PurchaseOrderStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`purchasing.orderStatus.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="open-orders"
                checked={open}
                onCheckedChange={(checked) => {
                  setOpen(checked);
                  resetPage();
                }}
              />
              <Label htmlFor="open-orders" className="text-sm font-normal">
                {t('purchasing.orders.onlyOpen')}
              </Label>
            </div>
          </>
        }
      />
    </>
  );
}
