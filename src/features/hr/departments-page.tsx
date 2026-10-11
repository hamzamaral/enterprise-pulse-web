import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getDepartmentsFindAllQueryKey,
  useDepartmentsCreate,
  useDepartmentsFindAll,
  useDepartmentsRemove,
  useDepartmentsUpdate,
} from '@/api/generated/endpoints/departments/departments';
import type { DepartmentDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { emptyToNull, useEmployeeOptions } from './hr-components';

const schema = z.object({
  code: v.code(),
  name: v.requiredString(),
  parentId: z.string(),
  managerId: z.string(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface TreeRow extends DepartmentDto {
  depth: number;
}

/** Orders departments depth-first so children follow their parent. */
function toTree(items: DepartmentDto[]): TreeRow[] {
  const byParent = new Map<string | null, DepartmentDto[]>();
  for (const item of items) {
    const key = items.some((p) => p.id === item.parentId) ? item.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), item]);
  }
  const rows: TreeRow[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const item of byParent.get(parentId) ?? []) {
      rows.push({ ...item, depth });
      walk(item.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

export function DepartmentsPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const { data, isLoading } = useDepartmentsFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: DepartmentDto | null }>({
    open: false,
    item: null,
  });
  const employeeOptions = useEmployeeOptions(editor.open);
  const invalidate = useInvalidate();
  const create = useDepartmentsCreate();
  const update = useDepartmentsUpdate();
  const remove = useDepartmentsRemove();

  const rows = useMemo(() => toTree(data ?? []), [data]);
  const parentOptions = (data ?? [])
    .filter((d) => d.id !== editor.item?.id)
    .map((d) => ({ value: d.id, label: d.name }));

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getDepartmentsFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const onSubmit = ({ parentId, managerId, isActive, ...rest }: FormValues) => {
    const payload = { ...rest, parentId: emptyToNull(parentId), managerId: emptyToNull(managerId) };
    if (editor.item) {
      update.mutate({ id: editor.item.id, data: { ...payload, isActive } }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  const columns = useMemo<ColumnDef<TreeRow, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2" style={{ paddingLeft: row.original.depth * 20 }}>
            {row.original.depth > 0 && <span className="text-muted-foreground">└</span>}
            <span className="font-medium">{row.original.name}</span>
            <code className="text-muted-foreground text-xs">{row.original.code}</code>
          </div>
        ),
      },
      {
        id: 'manager',
        header: t('departments.manager'),
        cell: ({ row }) => row.original.managerName ?? '—',
      },
      {
        id: 'employeeCount',
        header: t('departments.employeeCount'),
        cell: ({ row }) => row.original.employeeCount,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        size: 48,
        cell: ({ row }) =>
          can('departments:update') || can('departments:delete') ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('common.actions')}
                >
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can('departments:update') && (
                  <DropdownMenuItem onSelect={() => setEditor({ open: true, item: row.original })}>
                    <Pencil /> {t('common.edit')}
                  </DropdownMenuItem>
                )}
                {can('departments:delete') && (
                  <ConfirmDialog
                    trigger={
                      <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                        <Trash2 /> {t('common.delete')}
                      </DropdownMenuItem>
                    }
                    onConfirm={() =>
                      remove.mutate(
                        { id: row.original.id },
                        {
                          onSuccess: async () => {
                            toast.success(t('common.deleted'));
                            await invalidate(getDepartmentsFindAllQueryKey());
                          },
                        },
                      )
                    }
                  />
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, can],
  );

  return (
    <>
      <PageHeader
        title={t('departments.title')}
        description={t('departments.subtitle')}
        actions={
          <Can permission="departments:create">
            <Button onClick={() => setEditor({ open: true, item: null })}>
              <Plus /> {t('departments.new')}
            </Button>
          </Can>
        }
      />
      <DataTable columns={columns} data={rows} isLoading={isLoading} searchable={false} />
      <SimpleFormDialog<FormValues>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('departments.new')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          parentId: editor.item?.parentId ?? '',
          managerId: editor.item?.managerId ?? '',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'BT' },
          { name: 'name', label: t('common.name') },
          {
            name: 'parentId',
            label: t('departments.parent'),
            type: 'select',
            options: parentOptions,
          },
          {
            name: 'managerId',
            label: t('departments.manager'),
            type: 'select',
            options: employeeOptions,
          },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={onSubmit}
      />
    </>
  );
}
