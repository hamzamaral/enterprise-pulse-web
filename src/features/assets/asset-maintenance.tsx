import type { ColumnDef } from '@tanstack/react-table';
import { CheckCheck, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAssetsFindAllQueryKey,
  getAssetsFindMaintenancesQueryKey,
  getAssetsFindOneQueryKey,
  useAssetsCompleteMaintenance,
  useAssetsCreateMaintenance,
  useAssetsFindMaintenances,
} from '@/api/generated/endpoints/assets/assets';
import { MaintenanceType, type AssetDetailDto, type MaintenanceDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { DataTable } from '@/shared/components/data-table/data-table';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { today } from './asset-components';

const optionalCost = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
  z.number({ invalid_type_error: 'validation.number' }).min(0).optional(),
);

const createSchema = z.object({
  type: z.nativeEnum(MaintenanceType),
  title: z.string().trim().min(2, 'validation.required'),
  vendor: z.string(),
  cost: optionalCost,
  startedAt: v.requiredString(),
  description: z.string(),
});

const completeSchema = z.object({
  completedAt: v.requiredString(),
  cost: optionalCost,
  description: z.string(),
});

export function AssetMaintenanceTab({ asset }: { asset: AssetDetailDto }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidate();
  const { data, isLoading } = useAssetsFindMaintenances(asset.id);
  const create = useAssetsCreateMaintenance();
  const complete = useAssetsCompleteMaintenance();
  const [createOpen, setCreateOpen] = useState(false);
  const [completing, setCompleting] = useState<MaintenanceDto | null>(null);
  const canUpdate = can('assets:update');

  const refresh = () =>
    invalidate(
      getAssetsFindMaintenancesQueryKey(asset.id),
      getAssetsFindOneQueryKey(asset.id),
      getAssetsFindAllQueryKey(),
    );

  const columns = useMemo<ColumnDef<MaintenanceDto, unknown>[]>(
    () => [
      {
        id: 'title',
        header: t('assets.maintenanceTitle'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title}</div>
            {row.original.description && (
              <div className="text-muted-foreground max-w-80 truncate text-xs">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'type',
        header: t('assets.maintenanceType'),
        cell: ({ row }) => t(`assets.maintenanceTypes.${row.original.type}`),
      },
      { id: 'vendor', header: t('assets.vendor'), cell: ({ row }) => row.original.vendor ?? '—' },
      {
        id: 'period',
        header: t('assets.period'),
        cell: ({ row }) =>
          `${formatDate(row.original.startedAt)} – ${
            row.original.completedAt ? formatDate(row.original.completedAt) : '…'
          }`,
      },
      {
        id: 'cost',
        header: t('assets.cost'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.cost, asset.currency)}</span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <ToneBadge tone={row.original.status === 'OPEN' ? 'warning' : 'success'}>
            {t(`assets.maintenanceStatus.${row.original.status}`)}
          </ToneBadge>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canUpdate &&
          row.original.status === 'OPEN' && (
            <div className="flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setCompleting(row.original)}>
                <CheckCheck /> {t('assets.completeMaintenance')}
              </Button>
            </div>
          ),
      },
    ],
    [t, asset.currency, canUpdate],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={
          canUpdate &&
          asset.status === 'IN_STOCK' && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> {t('assets.newMaintenance')}
            </Button>
          )
        }
      />
      <SimpleFormDialog<z.infer<typeof createSchema>>
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t('assets.newMaintenance')}
        schema={createSchema}
        pending={create.isPending}
        defaultValues={{
          type: MaintenanceType.REPAIR,
          title: '',
          vendor: '',
          startedAt: today(),
          description: '',
        }}
        fields={[
          {
            name: 'type',
            label: t('assets.maintenanceType'),
            type: 'select',
            required: true,
            options: Object.values(MaintenanceType).map((type) => ({
              value: type,
              label: t(`assets.maintenanceTypes.${type}`),
            })),
          },
          { name: 'title', label: t('assets.maintenanceTitle') },
          { name: 'vendor', label: t('assets.vendor') },
          { name: 'cost', label: t('assets.estimatedCost'), type: 'number' },
          { name: 'startedAt', label: t('assets.startedAt'), type: 'date' },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
        ]}
        onSubmit={(values) =>
          create.mutate(
            {
              id: asset.id,
              data: {
                ...values,
                vendor: values.vendor || undefined,
                description: values.description || undefined,
              },
            },
            {
              onSuccess: async () => {
                toast.success(t('assets.maintenanceStarted'));
                await refresh();
                setCreateOpen(false);
              },
            },
          )
        }
      />
      <SimpleFormDialog<z.infer<typeof completeSchema>>
        open={!!completing}
        onOpenChange={(open) => !open && setCompleting(null)}
        title={completing ? `${t('assets.completeMaintenance')} · ${completing.title}` : ''}
        schema={completeSchema}
        pending={complete.isPending}
        defaultValues={{
          completedAt: today(),
          cost: completing?.cost ? Number(completing.cost) : undefined,
          description: completing?.description ?? '',
        }}
        fields={[
          { name: 'completedAt', label: t('assets.completedAt'), type: 'date' },
          { name: 'cost', label: t('assets.cost'), type: 'number' },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
        ]}
        onSubmit={(values) =>
          completing &&
          complete.mutate(
            {
              id: asset.id,
              maintenanceId: completing.id,
              data: { ...values, description: values.description || undefined },
            },
            {
              onSuccess: async () => {
                toast.success(t('assets.maintenanceCompleted'));
                await refresh();
                setCompleting(null);
              },
            },
          )
        }
      />
    </>
  );
}
