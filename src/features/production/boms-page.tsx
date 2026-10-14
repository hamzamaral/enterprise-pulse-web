import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  productionFindBoms,
  useProductionFindBoms,
} from '@/api/generated/endpoints/production/production';
import type { BomDto, ProductionFindBomsParams } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatMoney, formatQuantity } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';

const ACTIVE = 'active';
const INACTIVE = 'inactive';
const ALL = 'all';

/** Bills of materials (ürün ağaçları) with their rolled-up unit cost. */
export function BomsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'code', desc: false }] });
  const [state, setState] = useState(ACTIVE);

  const params: ProductionFindBomsParams = {
    ...table.params,
    isActive: state === ALL ? undefined : state === ACTIVE,
  };
  const { data, isLoading } = useProductionFindBoms(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<BomDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('production.bom.code'),
        cell: ({ row }) => (
          <Link
            to="/production/boms/$id"
            params={{ id: row.original.id }}
            className="font-mono text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.code}
          </Link>
        ),
      },
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <span className="block max-w-72">
            <span className="line-clamp-1">{row.original.name}</span>
            <span className="text-muted-foreground block text-xs">
              <code>{row.original.sku}</code> · {row.original.productName}
              {row.original.variantName && ` · ${row.original.variantName}`}
            </span>
          </span>
        ),
      },
      {
        id: 'quantity',
        header: t('production.bom.batch'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatQuantity(row.original.quantity, row.original.unitCode)}
          </span>
        ),
      },
      {
        id: 'lineCount',
        header: t('production.bom.lineCount'),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.lineCount}</span>,
      },
      {
        id: 'unitCost',
        header: t('production.cost.standardUnit'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatMoney(row.original.unitCost)}
          </span>
        ),
      },
      {
        id: 'workOrderCount',
        header: t('production.bom.workOrders'),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.workOrderCount}</span>,
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="inline-flex flex-wrap gap-1">
            {row.original.isDefault && (
              <ToneBadge tone="info">{t('production.bom.default')}</ToneBadge>
            )}
            <ActiveBadge active={row.original.isActive} />
          </span>
        ),
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      productionFindBoms({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'bills-of-materials',
      [
        { header: t('production.bom.code'), value: (r) => r.code },
        { header: t('common.name'), value: (r) => r.name },
        { header: t('production.sku'), value: (r) => r.sku },
        { header: t('production.product'), value: (r) => r.productName },
        { header: t('production.bom.batch'), value: (r) => Number(r.quantity) },
        { header: t('production.unit'), value: (r) => r.unitCode },
        { header: t('production.bom.lineCount'), value: (r) => r.lineCount },
        { header: t('production.cost.labor'), value: (r) => Number(r.laborCost) },
        { header: t('production.cost.overhead'), value: (r) => Number(r.overheadCost) },
        { header: t('production.cost.standardUnit'), value: (r) => Number(r.unitCost) },
        {
          header: t('production.bom.default'),
          value: (r) => (r.isDefault ? t('common.yes') : t('common.no')),
        },
        {
          header: t('common.status'),
          value: (r) => (r.isActive ? t('common.active') : t('common.inactive')),
        },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('production.bom.list')}
        description={t('production.bom.subtitle')}
        actions={
          <Can permission="production:update">
            <Button asChild>
              <Link to="/production/boms/new">
                <Plus /> {t('production.bom.new')}
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
        onRowClick={(row) => void navigate({ to: '/production/boms/$id', params: { id: row.id } })}
        toolbar={
          <Select
            value={state}
            onValueChange={(value) => {
              setState(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-36" aria-label={t('common.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ACTIVE}>{t('common.active')}</SelectItem>
              <SelectItem value={INACTIVE}>{t('common.inactive')}</SelectItem>
              <SelectItem value={ALL}>{t('production.filter.all')}</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    </>
  );
}
