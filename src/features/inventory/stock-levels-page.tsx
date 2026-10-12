import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, ArrowLeftRight, Boxes, Coins, Warehouse } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  stockFindLevels,
  useStockFindLevels,
  useStockSummary,
} from '@/api/generated/endpoints/inventory/inventory';
import type { StockLevelDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatMoney, formatQuantity } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import {
  ALL,
  LowStockBadge,
  TrackingBadge,
  useProductCategoryOptions,
  useWarehouseOptions,
} from './inventory-components';

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof Boxes;
  label: string;
  value: ReactNode;
  tone?: 'danger';
  onClick?: () => void;
}) {
  return (
    <Card
      className={cn('py-4', onClick && 'hover:border-primary/40 cursor-pointer transition-colors')}
      onClick={onClick}
    >
      <CardContent className="flex items-center gap-3 px-4">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-lg',
            tone === 'danger' ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="text-xl font-semibold tabular-nums">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function StockLevelsPage({ initialLowStock = false }: { initialLowStock?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'sku', desc: false }] });
  const [warehouseId, setWarehouseId] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [lowStock, setLowStock] = useState(initialLowStock);
  const warehouseOptions = useWarehouseOptions(true, false);
  const categoryOptions = useProductCategoryOptions();
  const { data: summary } = useStockSummary();

  const params = {
    ...table.params,
    warehouseId: warehouseId === ALL ? undefined : warehouseId,
    categoryId: categoryId === ALL ? undefined : categoryId,
    lowStock: lowStock || undefined,
  };
  const { data, isLoading } = useStockFindLevels(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<StockLevelDto, unknown>[]>(
    () => [
      {
        id: 'sku',
        header: t('inventory.sku'),
        cell: ({ row }) => <code className="text-xs">{row.original.sku}</code>,
      },
      {
        id: 'productName',
        header: t('inventory.product'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div>
              <div className="font-medium">{row.original.productName}</div>
              {row.original.variantName && (
                <div className="text-muted-foreground text-xs">{row.original.variantName}</div>
              )}
            </div>
            <TrackingBadge tracking={row.original.trackingType} />
          </div>
        ),
      },
      {
        id: 'category',
        header: t('inventory.category'),
        enableSorting: false,
        cell: ({ row }) => row.original.categoryName ?? '—',
      },
      {
        id: 'quantity',
        header: t('inventory.onHand'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 tabular-nums">
            {formatQuantity(row.original.quantity, row.original.unitCode)}
            {row.original.lowStock && <LowStockBadge />}
          </span>
        ),
      },
      {
        id: 'minStock',
        header: t('inventory.minStock'),
        enableSorting: false,
        cell: ({ row }) =>
          Number(row.original.minStock) > 0 ? (
            <span className="text-muted-foreground tabular-nums">
              {formatQuantity(row.original.minStock)}
            </span>
          ) : (
            '—'
          ),
      },
      {
        id: 'averageCost',
        header: t('inventory.averageCost'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.averageCost)}</span>
        ),
      },
      {
        id: 'stockValue',
        header: t('inventory.stockValue'),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">{formatMoney(row.original.stockValue)}</span>
        ),
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => stockFindLevels({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      'stock-levels',
      [
        { header: t('inventory.sku'), value: (r) => r.sku },
        { header: t('inventory.product'), value: (r) => r.productName },
        { header: t('inventory.variant'), value: (r) => r.variantName },
        { header: t('inventory.category'), value: (r) => r.categoryName },
        { header: t('inventory.unit'), value: (r) => r.unitCode },
        { header: t('inventory.onHand'), value: (r) => Number(r.quantity) },
        { header: t('inventory.minStock'), value: (r) => Number(r.minStock) },
        { header: t('inventory.averageCost'), value: (r) => Number(r.averageCost) },
        { header: t('inventory.stockValue'), value: (r) => Number(r.stockValue) },
        { header: t('inventory.lowStock'), value: (r) => (r.lowStock ? t('common.yes') : '') },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('inventory.title')}
        description={t('inventory.subtitle')}
        actions={
          <Can permission="inventory:move">
            <Button asChild>
              <Link to="/inventory/movements/new">
                <ArrowLeftRight /> {t('inventory.movements.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Boxes} label={t('inventory.summary.items')} value={summary?.itemCount} />
        <SummaryCard
          icon={AlertTriangle}
          label={t('inventory.summary.lowStock')}
          value={summary?.lowStockCount}
          tone={summary?.lowStockCount ? 'danger' : undefined}
          onClick={() => {
            setLowStock(true);
            resetPage();
          }}
        />
        <SummaryCard
          icon={Coins}
          label={t('inventory.summary.stockValue')}
          value={summary ? formatMoney(summary.stockValue) : undefined}
        />
        <SummaryCard
          icon={Warehouse}
          label={t('inventory.summary.warehouses')}
          value={summary?.warehouseCount}
        />
      </div>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/inventory/products/$id', params: { id: row.productId } })
        }
        toolbar={
          <>
            <Select
              value={warehouseId}
              onValueChange={(value) => {
                setWarehouseId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('inventory.allWarehouses')}</SelectItem>
                {warehouseOptions.map((w) => (
                  <SelectItem key={w.value} value={w.value}>
                    {w.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('inventory.allCategories')}</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="low-stock"
                checked={lowStock}
                onCheckedChange={(checked) => {
                  setLowStock(checked);
                  resetPage();
                }}
              />
              <Label htmlFor="low-stock" className="text-sm font-normal">
                {t('inventory.lowStockOnly')}
              </Label>
            </div>
          </>
        }
      />
    </>
  );
}
