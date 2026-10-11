import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getPositionsFindAllQueryKey,
  usePositionsCreate,
  usePositionsFindAll,
  usePositionsRemove,
  usePositionsUpdate,
} from '@/api/generated/endpoints/positions/positions';
import type { PositionDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { emptyToNull, useDepartmentOptions } from './hr-components';

const ALL = 'all';

const schema = z.object({
  code: v.code(),
  name: v.requiredString(),
  departmentId: z.string(),
  description: z.string(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function PositionsPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'name', desc: false }] });
  const [departmentId, setDepartmentId] = useState(ALL);
  const [editor, setEditor] = useState<{ open: boolean; item: PositionDto | null }>({
    open: false,
    item: null,
  });
  const departmentOptions = useDepartmentOptions();
  const invalidate = useInvalidate();
  const create = usePositionsCreate();
  const update = usePositionsUpdate();
  const remove = usePositionsRemove();

  const { data, isLoading } = usePositionsFindAll(
    { ...table.params, departmentId: departmentId === ALL ? undefined : departmentId },
    { query: tableQuery },
  );

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getPositionsFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const onSubmit = ({ departmentId: dept, description, isActive, ...rest }: FormValues) => {
    const payload = {
      ...rest,
      departmentId: emptyToNull(dept),
      description: emptyToNull(description),
    };
    if (editor.item) {
      update.mutate({ id: editor.item.id, data: { ...payload, isActive } }, { onSuccess });
    } else {
      create.mutate({ data: payload }, { onSuccess });
    }
  };

  const columns = useMemo<ColumnDef<PositionDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.description && (
              <div className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'department',
        header: t('positions.department'),
        enableSorting: false,
        cell: ({ row }) => row.original.departmentName ?? '—',
      },
      {
        id: 'employeeCount',
        header: t('positions.employeeCount'),
        enableSorting: false,
        cell: ({ row }) => row.original.employeeCount,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        size: 48,
        enableSorting: false,
        cell: ({ row }) =>
          can('positions:update') || can('positions:delete') ? (
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
                {can('positions:update') && (
                  <DropdownMenuItem onSelect={() => setEditor({ open: true, item: row.original })}>
                    <Pencil /> {t('common.edit')}
                  </DropdownMenuItem>
                )}
                {can('positions:delete') && (
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
                            await invalidate(getPositionsFindAllQueryKey());
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
        title={t('positions.title')}
        description={t('positions.subtitle')}
        actions={
          <Can permission="positions:create">
            <Button onClick={() => setEditor({ open: true, item: null })}>
              <Plus /> {t('positions.new')}
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
        toolbar={
          <Select
            value={departmentId}
            onValueChange={(value) => {
              setDepartmentId(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('employees.allDepartments')}</SelectItem>
              {departmentOptions.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SimpleFormDialog<FormValues>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('positions.new')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          departmentId: editor.item?.departmentId ?? '',
          description: editor.item?.description ?? '',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'YAZ' },
          { name: 'name', label: t('common.name') },
          {
            name: 'departmentId',
            label: t('positions.department'),
            type: 'select',
            options: departmentOptions,
            wide: true,
          },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
          ...(editor.item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={onSubmit}
      />
    </>
  );
}
