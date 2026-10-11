import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { productsFindAll, useProductsFindAll } from '@/api/generated/endpoints/inventory/inventory';
import { ProductType, type ProductDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatMoney, formatQuantity } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import {
  ALL,
  LowStockBadge,
  TrackingBadge,
  useProductCategoryOptions,
} from './inventory-components';
import { ProductFormDialog } from './product-form-dialog';

export function ProductsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'code', desc: false }] });
  const [type, setType] = useState(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const categoryOptions = useProductCategoryOptions();

  const params = {
    ...table.params,
    type: type === ALL ? undefined : (type as ProductType),
    categoryId: categoryId === ALL ? undefined : categoryId,
  };
  const { data, isLoading } = useProductsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<ProductDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name}</span>
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
        id: 'type',
        header: t('inventory.products.type'),
        enableSorting: false,
        cell: ({ row }) => t(`inventory.types.${row.original.type}`),
      },
      {
        id: 'variantCount',
        header: t('inventory.products.variantCount'),
        enableSorting: false,
        cell: ({ row }) => row.original.variantCount,
      },
      {
        id: 'onHand',
        header: t('inventory.onHand'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.type === ProductType.SERVICE ? (
            '—'
          ) : (
            <span className="flex items-center gap-2 tabular-nums">
              {formatQuantity(row.original.onHand, row.original.unitCode)}
              {row.original.lowStock && <LowStockBadge />}
            </span>
          ),
      },
      {
        id: 'salePrice',
        header: t('inventory.products.salePrice'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.salePrice, row.original.currency)}
          </span>
        ),
      },
      {
        id: 'isActive',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) => productsFindAll({ ...params, page, pageSize: 100 }));
    await exportToExcel(
      'products',
      [
        { header: t('common.code'), value: (p) => p.code },
        { header: t('common.name'), value: (p) => p.name },
        { header: t('inventory.category'), value: (p) => p.categoryName },
        { header: t('inventory.products.type'), value: (p) => t(`inventory.types.${p.type}`) },
        {
          header: t('inventory.products.tracking'),
          value: (p) => t(`inventory.trackingTypes.${p.trackingType}`),
        },
        { header: t('inventory.unit'), value: (p) => p.unitCode },
        { header: t('inventory.onHand'), value: (p) => Number(p.onHand) },
        {
          header: t('inventory.products.purchasePrice'),
          value: (p) => (p.purchasePrice ? Number(p.purchasePrice) : null),
        },
        {
          header: t('inventory.products.salePrice'),
          value: (p) => (p.salePrice ? Number(p.salePrice) : null),
        },
        { header: t('inventory.products.currency'), value: (p) => p.currency },
        {
          header: t('common.status'),
          value: (p) => (p.isActive ? t('common.active') : t('common.inactive')),
        },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('inventory.products.title')}
        description={t('inventory.products.subtitle')}
        actions={
          <Can permission="inventory:create">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('inventory.products.new')}
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
          void navigate({ to: '/inventory/products/$id', params: { id: row.id } })
        }
        toolbar={
          <>
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
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {Object.values(ProductType).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`inventory.types.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(product) =>
          void navigate({ to: '/inventory/products/$id', params: { id: product.id } })
        }
      />
    </>
  );
}
