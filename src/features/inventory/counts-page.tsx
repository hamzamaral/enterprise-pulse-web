import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getStockCountsFindAllQueryKey,
  useStockCountsCreate,
  useStockCountsFindAll,
} from '@/api/generated/endpoints/inventory/inventory';
import { StockCountStatus, type StockCountDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { emptyToNull } from '@/features/hr/hr-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate } from '@/shared/lib/format';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import {
  ALL,
  CountStatusBadge,
  useProductCategoryOptions,
  useWarehouseOptions,
} from './inventory-components';

const createSchema = z.object({
  warehouseId: v.requiredString(),
  countDate: v.requiredString(),
  categoryId: z.string(),
  notes: z.string(),
});

export function CountProgress({ count }: { count: StockCountDto }) {
  const percent = count.lineCount ? Math.round((count.countedCount / count.lineCount) * 100) : 0;
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {count.countedCount}/{count.lineCount}
      </span>
    </div>
  );
}

export function CountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const warehouseOptions = useWarehouseOptions(dialogOpen);
  const categoryOptions = useProductCategoryOptions(dialogOpen);
  const create = useStockCountsCreate();

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as StockCountStatus),
  };
  const { data, isLoading } = useStockCountsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<StockCountDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('inventory.counts.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'countDate',
        header: t('inventory.counts.date'),
        cell: ({ row }) => formatDate(row.original.countDate),
      },
      {
        id: 'warehouse',
        header: t('inventory.warehouse'),
        enableSorting: false,
        cell: ({ row }) => row.original.warehouseName,
      },
      {
        id: 'progress',
        header: t('inventory.counts.progress'),
        enableSorting: false,
        cell: ({ row }) => <CountProgress count={row.original} />,
      },
      {
        id: 'differenceCount',
        header: t('inventory.counts.differences'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.differenceCount ? (
            <span className="font-medium text-amber-600">{row.original.differenceCount}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <CountStatusBadge status={row.original.status} />,
      },
      {
        id: 'adjustment',
        header: t('inventory.counts.adjustment'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.adjustmentNumber ? (
            <code className="text-xs">{row.original.adjustmentNumber}</code>
          ) : (
            '—'
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

  return (
    <>
      <PageHeader
        title={t('inventory.counts.title')}
        description={t('inventory.counts.subtitle')}
        actions={
          <Can permission="inventory:count">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('inventory.counts.new')}
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
        onRowClick={(row) => void navigate({ to: '/inventory/counts/$id', params: { id: row.id } })}
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('common.all')}</SelectItem>
              {Object.values(StockCountStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`inventory.countStatus.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SimpleFormDialog<z.infer<typeof createSchema>>
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t('inventory.counts.new')}
        description={t('inventory.counts.newHint')}
        schema={createSchema}
        pending={create.isPending}
        defaultValues={{
          warehouseId: '',
          countDate: new Date().toISOString().slice(0, 10),
          categoryId: '',
          notes: '',
        }}
        fields={[
          {
            name: 'warehouseId',
            label: t('inventory.warehouse'),
            type: 'select',
            required: true,
            options: warehouseOptions,
          },
          { name: 'countDate', label: t('inventory.counts.date'), type: 'date' },
          {
            name: 'categoryId',
            label: t('inventory.counts.categoryFilter'),
            type: 'select',
            wide: true,
            options: categoryOptions,
          },
          { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
        ]}
        onSubmit={(values) =>
          create.mutate(
            {
              data: {
                warehouseId: values.warehouseId,
                countDate: values.countDate,
                categoryId: emptyToNull(values.categoryId) ?? undefined,
                notes: emptyToNull(values.notes) ?? undefined,
              },
            },
            {
              onSuccess: async (count) => {
                toast.success(t('inventory.counts.created', { number: count.number }));
                await invalidate(getStockCountsFindAllQueryKey());
                setDialogOpen(false);
                await navigate({ to: '/inventory/counts/$id', params: { id: count.id } });
              },
            },
          )
        }
      />
    </>
  );
}
