import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  productionFindWorkOrders,
  useProductionFindWorkOrders,
  useProductionSummary,
} from '@/api/generated/endpoints/production/production';
import {
  WorkOrderStatus,
  type ProductionFindWorkOrdersParams,
  type WorkOrderDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { ProgressBar } from '@/features/projects/project-components';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { WorkOrderDialog, WorkOrderStatusBadge } from './production-components';

const ALL = '__all__';
const OPEN = '__open__';
const LATE = '__late__';

const filterParams = (filter: string): Partial<ProductionFindWorkOrdersParams> => {
  if (filter === OPEN) return { open: true };
  if (filter === LATE) return { late: true };
  if (filter === ALL) return {};
  return { status: filter as WorkOrderStatus };
};

/** Production overview: KPIs and the work order list. */
export function WorkOrdersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [filter, setFilter] = useState(OPEN);
  const [creating, setCreating] = useState(false);

  const params: ProductionFindWorkOrdersParams = { ...table.params, ...filterParams(filter) };
  const { data, isLoading } = useProductionFindWorkOrders(params, { query: tableQuery });
  const { data: summary } = useProductionSummary();

  const columns = useMemo<ColumnDef<WorkOrderDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('production.workOrder.number'),
        cell: ({ row }) => (
          <Link
            to="/production/work-orders/$id"
            params={{ id: row.original.id }}
            className="font-mono text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'product',
        header: t('production.product'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-72">
            <span className="line-clamp-1">
              {row.original.productName}
              {row.original.variantName && ` · ${row.original.variantName}`}
            </span>
            <span className="text-muted-foreground block font-mono text-xs">
              {row.original.sku} · {row.original.bomCode}
            </span>
          </span>
        ),
      },
      {
        id: 'quantity',
        header: t('production.workOrder.produced'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block min-w-32">
            <span className="text-sm tabular-nums">
              {formatQuantity(row.original.producedQty)} /{' '}
              {formatQuantity(row.original.quantity, row.original.unitCode)}
            </span>
            <ProgressBar value={row.original.progress} />
          </span>
        ),
      },
      {
        id: 'plannedEnd',
        header: t('production.workOrder.plannedEnd'),
        cell: ({ row }) => (
          <span
            className={cn('whitespace-nowrap', row.original.late && 'text-destructive font-medium')}
          >
            {formatDate(row.original.plannedEnd)}
            {row.original.late && (
              <span className="block text-xs">{t('production.workOrder.late')}</span>
            )}
          </span>
        ),
      },
      {
        id: 'warehouses',
        header: t('production.workOrder.warehouses'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {row.original.sourceWarehouseName} → {row.original.targetWarehouseName}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <WorkOrderStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      productionFindWorkOrders({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'work-orders',
      [
        { header: t('production.workOrder.number'), value: (r) => r.number },
        { header: t('production.sku'), value: (r) => r.sku },
        { header: t('production.product'), value: (r) => r.productName },
        { header: t('production.bom.code'), value: (r) => r.bomCode },
        { header: t('production.quantity'), value: (r) => Number(r.quantity) },
        { header: t('production.workOrder.produced'), value: (r) => Number(r.producedQty) },
        { header: t('production.unit'), value: (r) => r.unitCode },
        { header: t('production.workOrder.plannedStart'), value: (r) => new Date(r.plannedStart) },
        { header: t('production.workOrder.plannedEnd'), value: (r) => new Date(r.plannedEnd) },
        { header: t('production.workOrder.sourceWarehouse'), value: (r) => r.sourceWarehouseName },
        { header: t('production.workOrder.targetWarehouse'), value: (r) => r.targetWarehouseName },
        { header: t('common.status'), value: (r) => t(`production.status.${r.status}`) },
        { header: t('production.workOrder.reference'), value: (r) => r.reference },
      ],
      rows,
    );
  };

  const open = summary && summary.draft + summary.released + summary.inProgress;

  return (
    <>
      <PageHeader
        title={t('production.title')}
        description={t('production.subtitle')}
        actions={
          <Can permission="production:update">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('production.workOrder.new')}
            </Button>
          </Can>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('production.kpi.open')}
          value={open}
          hint={
            summary &&
            t('production.kpi.openHint', {
              draft: summary.draft,
              released: summary.released,
              inProgress: summary.inProgress,
            })
          }
        />
        <KpiCard
          label={t('production.kpi.late')}
          value={summary?.late}
          tone={summary?.late ? 'negative' : undefined}
          hint={t('production.kpi.lateHint')}
        />
        <KpiCard
          label={t('production.kpi.completed')}
          value={summary?.completedThisMonth}
          hint={
            summary &&
            t('production.kpi.completedHint', {
              amount: formatMoney(summary.producedValueThisMonth),
            })
          }
        />
        <KpiCard
          label={t('production.kpi.shortages')}
          value={summary?.shortages}
          tone={summary?.shortages ? 'negative' : 'positive'}
          hint={
            <Link to="/production/requirements" className="hover:underline">
              {t('production.kpi.shortagesHint')}
            </Link>
          }
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
          void navigate({ to: '/production/work-orders/$id', params: { id: row.id } })
        }
        toolbar={
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-44" aria-label={t('common.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OPEN}>{t('production.filter.open')}</SelectItem>
              <SelectItem value={LATE}>{t('production.filter.late')}</SelectItem>
              <SelectItem value={ALL}>{t('production.filter.all')}</SelectItem>
              {Object.values(WorkOrderStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`production.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <WorkOrderDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(order) =>
          void navigate({ to: '/production/work-orders/$id', params: { id: order.id } })
        }
      />
    </>
  );
}
