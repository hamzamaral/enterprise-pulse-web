import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { assetsFindAll, useAssetsFindAll } from '@/api/generated/endpoints/assets/assets';
import { AssetStatus, type AssetDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Assignee, AssetStatusBadge, useCategoryOptions } from './asset-components';
import { AssetFormDialog } from './asset-form-dialog';

const ALL = 'all';

export function AssetsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'assetTag', desc: false }] });
  const [status, setStatus] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const categoryOptions = useCategoryOptions();

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as AssetStatus),
    categoryId: categoryId === ALL ? undefined : categoryId,
  };
  const { data, isLoading } = useAssetsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<AssetDto, unknown>[]>(
    () => [
      {
        id: 'assetTag',
        header: t('assets.assetTag'),
        cell: ({ row }) => <code className="text-xs">{row.original.assetTag}</code>,
      },
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-muted-foreground text-xs">
              {[row.original.brand, row.original.model].filter(Boolean).join(' ')}
            </div>
          </div>
        ),
      },
      {
        id: 'category',
        header: t('assets.category'),
        enableSorting: false,
        cell: ({ row }) => row.original.categoryName,
      },
      {
        id: 'serialNumber',
        header: t('assets.serialNumber'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.serialNumber ?? '—'}</span>
        ),
      },
      {
        id: 'holder',
        header: t('assets.holderOrLocation'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.holder ? (
            <Assignee type={row.original.holder.type} name={row.original.holder.name} />
          ) : row.original.locationName ? (
            <Assignee type="LOCATION" name={row.original.locationName} />
          ) : (
            '—'
          ),
      },
      {
        id: 'purchaseDate',
        header: t('assets.purchaseDate'),
        cell: ({ row }) => formatDate(row.original.purchaseDate),
      },
      {
        id: 'purchaseCost',
        header: t('assets.purchaseCost'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.purchaseCost, row.original.currency)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <AssetStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => assetsFindAll({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      'assets',
      [
        { header: t('assets.assetTag'), value: (a) => a.assetTag },
        { header: t('common.name'), value: (a) => a.name },
        { header: t('assets.category'), value: (a) => a.categoryName },
        { header: t('assets.brand'), value: (a) => a.brand },
        { header: t('assets.model'), value: (a) => a.model },
        { header: t('assets.serialNumber'), value: (a) => a.serialNumber },
        { header: t('assets.holder'), value: (a) => a.holder?.name ?? null },
        { header: t('assets.location'), value: (a) => a.locationName },
        {
          header: t('assets.purchaseDate'),
          value: (a) => (a.purchaseDate ? new Date(a.purchaseDate) : null),
        },
        {
          header: t('assets.purchaseCost'),
          value: (a) => (a.purchaseCost ? Number(a.purchaseCost) : null),
        },
        { header: t('assets.currency'), value: (a) => a.currency },
        {
          header: t('assets.warrantyEndDate'),
          value: (a) => (a.warrantyEndDate ? new Date(a.warrantyEndDate) : null),
        },
        { header: t('assets.condition'), value: (a) => t(`assets.conditions.${a.condition}`) },
        { header: t('common.status'), value: (a) => t(`assets.status.${a.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('assets.title')}
        description={t('assets.subtitle')}
        actions={
          <Can permission="assets:create">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('assets.new')}
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
        onRowClick={(row) => void navigate({ to: '/assets/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={categoryId}
              onValueChange={(value) => {
                setCategoryId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('assets.allCategories')}</SelectItem>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
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
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {Object.values(AssetStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`assets.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(asset) => void navigate({ to: '/assets/$id', params: { id: asset.id } })}
      />
    </>
  );
}
