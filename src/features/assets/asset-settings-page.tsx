import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAssetCategoriesFindAllQueryKey,
  getAssetLocationsFindAllQueryKey,
  useAssetCategoriesCreate,
  useAssetCategoriesFindAll,
  useAssetCategoriesUpdate,
  useAssetLocationsCreate,
  useAssetLocationsFindAll,
  useAssetLocationsUpdate,
} from '@/api/generated/endpoints/assets/assets';
import { useBranchesFindAll } from '@/api/generated/endpoints/branches/branches';
import type { AssetCategoryDto, AssetLocationDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="icon" className="size-8" aria-label={label} onClick={onClick}>
        <Pencil />
      </Button>
    </div>
  );
}

const categorySchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  usefulLifeMonths: z.coerce
    .number({ invalid_type_error: 'validation.number' })
    .int()
    .min(1)
    .max(600),
  isActive: z.boolean(),
});

function CategoriesTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useAssetCategoriesFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: AssetCategoryDto | null }>({
    open: false,
    item: null,
  });
  const invalidate = useInvalidate();
  const create = useAssetCategoriesCreate();
  const update = useAssetCategoriesUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getAssetCategoriesFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<AssetCategoryDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            {row.original.name}
            <code className="text-muted-foreground text-xs font-normal">{row.original.code}</code>
          </span>
        ),
      },
      {
        id: 'usefulLifeMonths',
        header: t('assets.usefulLifeMonths'),
        cell: ({ row }) => t('assets.monthsValue', { count: row.original.usefulLifeMonths }),
      },
      {
        id: 'assetCount',
        header: t('assets.assetCount'),
        cell: ({ row }) => row.original.assetCount,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <EditButton
            label={t('common.edit')}
            onClick={() => setEditor({ open: true, item: row.original })}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={
          <Button size="sm" onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('assets.newCategory')}
          </Button>
        }
      />
      <SimpleFormDialog<z.infer<typeof categorySchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('assets.newCategory')}
        schema={categorySchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          usefulLifeMonths: editor.item?.usefulLifeMonths ?? 36,
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'BLG' },
          { name: 'name', label: t('common.name') },
          { name: 'usefulLifeMonths', label: t('assets.usefulLifeMonths'), type: 'number' },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={({ isActive, ...rest }) =>
          editor.item
            ? update.mutate({ id: editor.item.id, data: { ...rest, isActive } }, { onSuccess })
            : create.mutate({ data: rest }, { onSuccess })
        }
      />
    </>
  );
}

const locationSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  branchId: z.string(),
  description: z.string(),
  isActive: z.boolean(),
});

function LocationsTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useAssetLocationsFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: AssetLocationDto | null }>({
    open: false,
    item: null,
  });
  const { data: branches } = useBranchesFindAll(
    { pageSize: 100 },
    { query: { enabled: editor.open } },
  );
  const invalidate = useInvalidate();
  const create = useAssetLocationsCreate();
  const update = useAssetLocationsUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getAssetLocationsFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<AssetLocationDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <span className="flex items-center gap-2 font-medium">
              {row.original.name}
              <code className="text-muted-foreground text-xs font-normal">{row.original.code}</code>
            </span>
            {row.original.description && (
              <div className="text-muted-foreground text-xs">{row.original.description}</div>
            )}
          </div>
        ),
      },
      {
        id: 'branch',
        header: t('employees.branch'),
        cell: ({ row }) => row.original.branchName ?? '—',
      },
      {
        id: 'assetCount',
        header: t('assets.assetCount'),
        cell: ({ row }) => row.original.assetCount,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <EditButton
            label={t('common.edit')}
            onClick={() => setEditor({ open: true, item: row.original })}
          />
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={
          <Button size="sm" onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('assets.newLocation')}
          </Button>
        }
      />
      <SimpleFormDialog<z.infer<typeof locationSchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('assets.newLocation')}
        schema={locationSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          branchId: editor.item?.branchId ?? '',
          description: editor.item?.description ?? '',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'DEPO' },
          { name: 'name', label: t('common.name') },
          {
            name: 'branchId',
            label: t('employees.branch'),
            type: 'select',
            wide: true,
            options: (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={({ isActive, branchId, description, ...rest }) => {
          const data = {
            ...rest,
            branchId: emptyToNull(branchId),
            description: emptyToNull(description),
          };
          if (editor.item) {
            update.mutate({ id: editor.item.id, data: { ...data, isActive } }, { onSuccess });
          } else {
            create.mutate({ data }, { onSuccess });
          }
        }}
      />
    </>
  );
}

export function AssetSettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('assets.settingsTitle')} description={t('assets.settingsSubtitle')} />
      <Tabs defaultValue="categories">
        <TabsList className="mb-4">
          <TabsTrigger value="categories">{t('assets.categories')}</TabsTrigger>
          <TabsTrigger value="locations">{t('assets.locations')}</TabsTrigger>
        </TabsList>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
        <TabsContent value="locations">
          <LocationsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
