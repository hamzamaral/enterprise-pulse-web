import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useBranchesFindAll } from '@/api/generated/endpoints/branches/branches';
import {
  getProductCategoriesFindAllQueryKey,
  getWarehousesFindAllQueryKey,
  useProductCategoriesCreate,
  useProductCategoriesFindAll,
  useProductCategoriesUpdate,
  useWarehousesCreate,
  useWarehousesFindAll,
  useWarehousesUpdate,
} from '@/api/generated/endpoints/inventory/inventory';
import type { ProductCategoryDto, WarehouseDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
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
  parentId: z.string(),
  isActive: z.boolean(),
});

function CategoriesTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useProductCategoriesFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: ProductCategoryDto | null }>({
    open: false,
    item: null,
  });
  const invalidate = useInvalidate();
  const create = useProductCategoriesCreate();
  const update = useProductCategoriesUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getProductCategoriesFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<ProductCategoryDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            {row.original.parentName && (
              <span className="text-muted-foreground font-normal">{row.original.parentName} ›</span>
            )}
            {row.original.name}
            <code className="text-muted-foreground text-xs font-normal">{row.original.code}</code>
          </span>
        ),
      },
      {
        id: 'productCount',
        header: t('inventory.settings.productCount'),
        cell: ({ row }) => row.original.productCount,
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

  const parentOptions = (data ?? [])
    .filter((c) => c.isActive && c.id !== editor.item?.id)
    .map((c) => ({ value: c.id, label: c.name }));

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={
          <Button size="sm" onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('inventory.settings.newCategory')}
          </Button>
        }
      />
      <SimpleFormDialog<z.infer<typeof categorySchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('inventory.settings.newCategory')}
        schema={categorySchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          parentId: editor.item?.parentId ?? '',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'ELK' },
          { name: 'name', label: t('common.name') },
          {
            name: 'parentId',
            label: t('inventory.settings.parentCategory'),
            type: 'select',
            wide: true,
            options: parentOptions,
          },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={({ isActive, parentId, ...rest }) => {
          const data = { ...rest, parentId: emptyToNull(parentId) };
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

const warehouseSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  branchId: z.string(),
  address: z.string(),
  isActive: z.boolean(),
});

function WarehousesTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useWarehousesFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: WarehouseDto | null }>({
    open: false,
    item: null,
  });
  const { data: branches } = useBranchesFindAll(
    { pageSize: 100 },
    { query: { enabled: editor.open } },
  );
  const invalidate = useInvalidate();
  const create = useWarehousesCreate();
  const update = useWarehousesUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getWarehousesFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<WarehouseDto, unknown>[]>(
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
            {row.original.address && (
              <div className="text-muted-foreground text-xs">{row.original.address}</div>
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
        id: 'itemCount',
        header: t('inventory.settings.itemCount'),
        cell: ({ row }) => row.original.itemCount,
      },
      {
        id: 'stockValue',
        header: t('inventory.stockValue'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.stockValue)}</span>
        ),
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
            <Plus /> {t('inventory.settings.newWarehouse')}
          </Button>
        }
      />
      <SimpleFormDialog<z.infer<typeof warehouseSchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('inventory.settings.newWarehouse')}
        description={editor.item ? t('inventory.settings.deactivateHint') : undefined}
        schema={warehouseSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          branchId: editor.item?.branchId ?? '',
          address: editor.item?.address ?? '',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'MRK' },
          { name: 'name', label: t('common.name') },
          {
            name: 'branchId',
            label: t('employees.branch'),
            type: 'select',
            wide: true,
            options: (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
          { name: 'address', label: t('common.address'), type: 'textarea', wide: true },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={({ isActive, branchId, address, ...rest }) => {
          const data = {
            ...rest,
            branchId: emptyToNull(branchId),
            address: emptyToNull(address),
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

export function InventorySettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('inventory.settings.title')}
        description={t('inventory.settings.subtitle')}
      />
      <Tabs defaultValue="warehouses">
        <TabsList className="mb-4">
          <TabsTrigger value="warehouses">{t('inventory.settings.warehouses')}</TabsTrigger>
          <TabsTrigger value="categories">{t('inventory.settings.categories')}</TabsTrigger>
        </TabsList>
        <TabsContent value="warehouses">
          <WarehousesTab />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
