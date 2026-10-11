import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { salesOrdersFindAll, useSalesOrdersFindAll } from '@/api/generated/endpoints/sales/sales';
import { SalesOrderStatus, type SalesOrderDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { ProgressCell } from '@/features/purchasing/orders-page';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { SalesOrderStatusBadge } from './sales-components';

const ALL = 'ALL';

export function SalesOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [open, setOpen] = useState(false);
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as SalesOrderStatus),
    open: open || undefined,
  };
  const { data, isLoading } = useSalesOrdersFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<SalesOrderDto, unknown>[]>(
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
        header: t('sales.customer'),
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.partnerTitle}</span>
            {row.original.customerRef && (
              <span className="text-muted-foreground block text-xs">
                {row.original.customerRef}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'warehouse',
        header: t('sales.orders.warehouse'),
        enableSorting: false,
        cell: ({ row }) => row.original.warehouseName,
      },
      {
        id: 'deliveryDate',
        header: t('sales.orders.deliveryDate'),
        cell: ({ row }) => formatDate(row.original.deliveryDate),
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
        id: 'delivered',
        header: t('sales.orders.delivered'),
        enableSorting: false,
        cell: ({ row }) => <ProgressCell percent={row.original.deliveredPercent} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <SalesOrderStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      salesOrdersFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'sales-orders',
      [
        { header: t('trade.number'), value: (o) => o.number },
        { header: t('trade.date'), value: (o) => new Date(o.orderDate) },
        { header: t('sales.customer'), value: (o) => o.partnerTitle },
        { header: t('sales.orders.customerRef'), value: (o) => o.customerRef },
        { header: t('sales.orders.warehouse'), value: (o) => o.warehouseName },
        {
          header: t('sales.orders.deliveryDate'),
          value: (o) => (o.deliveryDate ? new Date(o.deliveryDate) : null),
        },
        { header: t('trade.currency'), value: (o) => o.currencyCode },
        { header: t('trade.grandTotal'), value: (o) => Number(o.grandTotal) },
        { header: t('trade.grandTotalBase'), value: (o) => Number(o.grandTotalBase) },
        { header: t('sales.orders.delivered'), value: (o) => o.deliveredPercent / 100 },
        { header: t('common.status'), value: (o) => t(`sales.orderStatus.${o.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('sales.orders.title')}
        description={t('sales.orders.subtitle')}
        actions={
          <Can permission="sales:create">
            <Button asChild>
              <Link to="/sales/orders/new">
                <Plus /> {t('sales.orders.new')}
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
        onRowClick={(row) => void navigate({ to: '/sales/orders/$id', params: { id: row.id } })}
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
                {Object.values(SalesOrderStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`sales.orderStatus.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="open-sales-orders"
                checked={open}
                onCheckedChange={(checked) => {
                  setOpen(checked);
                  resetPage();
                }}
              />
              <Label htmlFor="open-sales-orders" className="text-sm font-normal">
                {t('sales.orders.onlyOpen')}
              </Label>
            </div>
          </>
        }
      />
    </>
  );
}
