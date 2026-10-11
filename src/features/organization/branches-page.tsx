import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  branchesFindAll,
  getBranchesFindAllQueryKey,
  useBranchesCreate,
  useBranchesFindAll,
  useBranchesRemove,
  useBranchesUpdate,
} from '@/api/generated/endpoints/branches/branches';
import { getAuthMeQueryKey } from '@/api/generated/endpoints/auth/auth';
import type { BranchDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { fetchAllPages, tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';

const schema = z.object({
  code: v.code(),
  name: v.requiredString(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('validation.email')]).optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const clean = (values: FormValues) => ({
  ...values,
  city: values.city || undefined,
  phone: values.phone || undefined,
  email: values.email || undefined,
  address: values.address || undefined,
});

export function BranchesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'name', desc: false }] });
  const { data, isLoading } = useBranchesFindAll(table.params, { query: tableQuery });
  const [editing, setEditing] = useState<BranchDto | null>(null);
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidate();
  const create = useBranchesCreate();
  const update = useBranchesUpdate();
  const remove = useBranchesRemove();

  const refresh = () => invalidate(getBranchesFindAllQueryKey(), getAuthMeQueryKey());
  const onSaved = async () => {
    toast.success(t('common.saved'));
    await refresh();
    setOpen(false);
  };

  const columns = useMemo<ColumnDef<BranchDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        id: 'city',
        header: t('common.city'),
        enableSorting: false,
        cell: ({ row }) => row.original.city ?? '—',
      },
      {
        id: 'phone',
        header: t('common.phone'),
        enableSorting: false,
        cell: ({ row }) => row.original.phone ?? '—',
      },
      {
        id: 'isActive',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'createdAt',
        header: t('common.createdAt'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {can('branches:update') && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.edit')}
                onClick={() => {
                  setEditing(row.original);
                  setOpen(true);
                }}
              >
                <Pencil />
              </Button>
            )}
            {can('branches:delete') && (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 />
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id: row.original.id },
                    {
                      onSuccess: () =>
                        void refresh().then(() => toast.success(t('common.deleted'))),
                    },
                  )
                }
              />
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, can],
  );

  return (
    <>
      <PageHeader
        title={t('organization.branchesTitle')}
        description={t('organization.branchesSubtitle')}
        actions={
          <Can permission="branches:create">
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t('organization.newBranch')}
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
        onExport={async () =>
          exportToExcel(
            'branches',
            [
              { header: t('common.code'), value: (b) => b.code },
              { header: t('common.name'), value: (b) => b.name },
              { header: t('common.city'), value: (b) => b.city },
              { header: t('common.phone'), value: (b) => b.phone },
              { header: t('common.email'), value: (b) => b.email },
            ],
            await fetchAllPages((page) =>
              branchesFindAll({ ...table.params, page, pageSize: 100 }),
            ),
          )
        }
      />
      <SimpleFormDialog<FormValues>
        open={open}
        onOpenChange={setOpen}
        title={editing ? t('common.edit') : t('organization.newBranch')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editing?.code ?? '',
          name: editing?.name ?? '',
          city: editing?.city ?? '',
          phone: editing?.phone ?? '',
          email: editing?.email ?? '',
          address: editing?.address ?? '',
          isActive: editing?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'IST-01' },
          { name: 'name', label: t('common.name') },
          { name: 'city', label: t('common.city') },
          { name: 'phone', label: t('common.phone') },
          { name: 'email', label: t('common.email'), type: 'email', wide: true },
          { name: 'address', label: t('common.address'), wide: true },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
        onSubmit={(values) =>
          editing
            ? update.mutate({ id: editing.id, data: clean(values) }, { onSuccess: onSaved })
            : create.mutate(
                { data: (({ isActive: _, ...rest }) => rest)(clean(values)) },
                { onSuccess: onSaved },
              )
        }
      />
    </>
  );
}
