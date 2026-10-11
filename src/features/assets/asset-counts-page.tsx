import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAssetCountsFindAllQueryKey,
  useAssetCountsCreate,
  useAssetCountsFindAll,
} from '@/api/generated/endpoints/assets/assets';
import { AssetCountStatus, type AssetCountDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { emptyToNull } from '@/features/hr/hr-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { today, useCategoryOptions, useLocationOptions } from './asset-components';

const ALL = '__all__';

const createSchema = z.object({
  countDate: v.requiredString(),
  locationId: z.string(),
  categoryId: z.string(),
  notes: z.string(),
});

const STATUS_TONES: Record<AssetCountStatus, Tone> = {
  DRAFT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function AssetCountStatusBadge({ status }: { status: AssetCountStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`assets.counts.status.${status}`)}</ToneBadge>;
}

export function AssetCountProgress({ count }: { count: AssetCountDto }) {
  const percent = count.expectedCount
    ? Math.round((count.foundCount / count.expectedCount) * 100)
    : 0;
  return (
    <div className="flex min-w-32 items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {count.foundCount}/{count.expectedCount}
      </span>
    </div>
  );
}

export const scopeLabel = (count: AssetCountDto, allAssetsLabel: string) =>
  [count.locationName, count.categoryName].filter(Boolean).join(' · ') || allAssetsLabel;

export function AssetCountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const locationOptions = useLocationOptions(dialogOpen);
  const categoryOptions = useCategoryOptions(dialogOpen);
  const create = useAssetCountsCreate();

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as AssetCountStatus),
  };
  const { data, isLoading } = useAssetCountsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<AssetCountDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('assets.counts.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'countDate',
        header: t('assets.counts.date'),
        cell: ({ row }) => formatDate(row.original.countDate),
      },
      {
        id: 'scope',
        header: t('assets.counts.scope'),
        enableSorting: false,
        cell: ({ row }) => scopeLabel(row.original, t('assets.counts.allAssets')),
      },
      {
        id: 'progress',
        header: t('assets.counts.progress'),
        enableSorting: false,
        cell: ({ row }) => <AssetCountProgress count={row.original} />,
      },
      {
        id: 'missingCount',
        header: t('assets.counts.missing'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.missingCount ? (
            <span className="text-destructive font-medium">{row.original.missingCount}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'unexpectedCount',
        header: t('assets.counts.unexpected'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.unexpectedCount ? (
            <span className="font-medium text-amber-600">{row.original.unexpectedCount}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <AssetCountStatusBadge status={row.original.status} />,
      },
      {
        id: 'createdBy',
        header: t('assets.counts.createdBy'),
        enableSorting: false,
        cell: ({ row }) => row.original.createdByName,
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('assets.counts.title')}
        description={t('assets.counts.subtitle')}
        actions={
          <Can permission="assets:count">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('assets.counts.new')}
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
        onRowClick={(row) => void navigate({ to: '/assets/counts/$id', params: { id: row.id } })}
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
              {Object.values(AssetCountStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`assets.counts.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SimpleFormDialog<z.infer<typeof createSchema>>
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t('assets.counts.new')}
        description={t('assets.counts.newHint')}
        schema={createSchema}
        pending={create.isPending}
        defaultValues={{ countDate: today(), locationId: '', categoryId: '', notes: '' }}
        fields={[
          { name: 'countDate', label: t('assets.counts.date'), type: 'date' },
          {
            name: 'locationId',
            label: t('assets.counts.location'),
            type: 'select',
            options: locationOptions,
          },
          {
            name: 'categoryId',
            label: t('assets.counts.category'),
            type: 'select',
            options: categoryOptions,
          },
          { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
        ]}
        onSubmit={(values) =>
          create.mutate(
            {
              data: {
                countDate: values.countDate,
                locationId: emptyToNull(values.locationId) ?? undefined,
                categoryId: emptyToNull(values.categoryId) ?? undefined,
                notes: emptyToNull(values.notes) ?? undefined,
              },
            },
            {
              onSuccess: async (count) => {
                toast.success(t('assets.counts.created', { number: count.number }));
                await invalidate(getAssetCountsFindAllQueryKey());
                setDialogOpen(false);
                await navigate({ to: '/assets/counts/$id', params: { id: count.id } });
              },
            },
          )
        }
      />
    </>
  );
}
