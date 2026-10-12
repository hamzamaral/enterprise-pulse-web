import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowRight, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  stockMovementsFindAll,
  useStockMovementsFindAll,
} from '@/api/generated/endpoints/inventory/inventory';
import { StockMovementType, type StockMovementDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ALL, MovementTypeBadge, useWarehouseOptions } from './inventory-components';

export function WarehouseRoute({ movement }: { movement: StockMovementDto }) {
  const { sourceWarehouseName: source, targetWarehouseName: target } = movement;
  if (source && target) {
    return (
      <span className="inline-flex items-center gap-1">
        {source} <ArrowRight className="text-muted-foreground size-3.5" /> {target}
      </span>
    );
  }
  return <>{source ?? target}</>;
}

export function MovementsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [type, setType] = useState(ALL);
  const [warehouseId, setWarehouseId] = useState(ALL);
  const warehouseOptions = useWarehouseOptions(true, false);

  const params = {
    ...table.params,
    type: type === ALL ? undefined : (type as StockMovementType),
    warehouseId: warehouseId === ALL ? undefined : warehouseId,
  };
  const { data, isLoading } = useStockMovementsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<StockMovementDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('inventory.movements.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'movementDate',
        header: t('inventory.movements.date'),
        cell: ({ row }) => formatDate(row.original.movementDate),
      },
      {
        id: 'type',
        header: t('inventory.movements.type'),
        enableSorting: false,
        cell: ({ row }) => <MovementTypeBadge type={row.original.type} />,
      },
      {
        id: 'warehouse',
        header: t('inventory.warehouse'),
        enableSorting: false,
        cell: ({ row }) => <WarehouseRoute movement={row.original} />,
      },
      {
        id: 'reference',
        header: t('inventory.movements.reference'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.original.reference ?? '—'}</span>
        ),
      },
      {
        id: 'lineCount',
        header: t('inventory.movements.lineCount'),
        enableSorting: false,
        cell: ({ row }) => row.original.lineCount,
      },
      {
        id: 'totalValue',
        header: t('inventory.movements.totalValue'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.totalValue)}</span>
        ),
      },
      {
        id: 'createdBy',
        header: t('inventory.movements.createdBy'),
        enableSorting: false,
        cell: ({ row }) => row.original.createdByName,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      stockMovementsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'stock-movements',
      [
        { header: t('inventory.movements.number'), value: (m) => m.number },
        { header: t('inventory.movements.date'), value: (m) => new Date(m.movementDate) },
        {
          header: t('inventory.movements.type'),
          value: (m) => t(`inventory.movementTypes.${m.type}`),
        },
        { header: t('inventory.movements.source'), value: (m) => m.sourceWarehouseName },
        { header: t('inventory.movements.target'), value: (m) => m.targetWarehouseName },
        { header: t('inventory.movements.reference'), value: (m) => m.reference },
        { header: t('inventory.movements.lineCount'), value: (m) => m.lineCount },
        { header: t('inventory.movements.totalValue'), value: (m) => Number(m.totalValue) },
        { header: t('inventory.movements.createdBy'), value: (m) => m.createdByName },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('inventory.movements.title')}
        description={t('inventory.movements.subtitle')}
        actions={
          <Can permission="inventory:move">
            <Button asChild>
              <Link to="/inventory/movements/new">
                <Plus /> {t('inventory.movements.new')}
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
          void navigate({ to: '/inventory/movements/$id', params: { id: row.id } })
        }
        toolbar={
          <>
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
                <SelectItem value={ALL}>{t('inventory.allTypes')}</SelectItem>
                {Object.values(StockMovementType).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`inventory.movementTypes.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          </>
        }
      />
    </>
  );
}
