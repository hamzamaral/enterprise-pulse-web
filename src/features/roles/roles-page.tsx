import { zodResolver } from '@hookform/resolvers/zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getRolesFindAllQueryKey,
  usePermissionsFindAll,
  useRolesCreate,
  useRolesFindAll,
  useRolesRemove,
  useRolesUpdate,
} from '@/api/generated/endpoints/roles/roles';
import type { RoleDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { PermissionMatrix } from './permission-matrix';

const schema = z.object({
  code: z.string().regex(/^[a-z0-9-]{2,50}$/, 'validation.code'),
  name: v.requiredString(),
  description: z.string().optional(),
  permissionCodes: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

function RoleDialog({
  open,
  onOpenChange,
  role,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: RoleDto | null;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const { data: permissions } = usePermissionsFindAll({
    query: { enabled: open, staleTime: Infinity },
  });
  const create = useRolesCreate();
  const update = useRolesUpdate();
  const locked = !!role?.isSystem;

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  useEffect(() => {
    if (open) {
      form.reset({
        code: role?.code ?? '',
        name: role?.name ?? '',
        description: role?.description ?? '',
        permissionCodes: role?.permissionCodes ?? [],
      });
    }
  }, [open, role, form]);

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getRolesFindAllQueryKey());
    onOpenChange(false);
  };

  const onSubmit = (values: FormValues) => {
    const data = { ...values, description: values.description || undefined };
    if (role) update.mutate({ id: role.id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{role ? t('roles.editTitle') : t('roles.new')}</DialogTitle>
          {locked && (
            <DialogDescription className="flex items-center gap-1.5">
              <Lock className="size-3.5" /> {t('roles.systemLocked')}
            </DialogDescription>
          )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.code')}</FormLabel>
                    <FormControl>
                      <Input placeholder="warehouse-staff" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </fieldset>
            <FormField
              control={form.control}
              name="permissionCodes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('roles.permissions')}</FormLabel>
                  <PermissionMatrix
                    permissions={permissions ?? []}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    disabled={locked}
                  />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              {!locked && (
                <Button type="submit" disabled={pending}>
                  {pending && <Loader2 className="animate-spin" />}
                  {t('common.save')}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'name', desc: false }] });
  const { data, isLoading } = useRolesFindAll(table.params, { query: tableQuery });
  const [editing, setEditing] = useState<RoleDto | null>(null);
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidate();
  const remove = useRolesRemove();

  const columns = useMemo<ColumnDef<RoleDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-2 font-medium">
              {row.original.name}
              {row.original.isSystem && <ToneBadge tone="info">{t('roles.system')}</ToneBadge>}
            </div>
            {row.original.description && (
              <div className="text-muted-foreground text-xs">{row.original.description}</div>
            )}
          </div>
        ),
      },
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      {
        id: 'permissions',
        header: t('roles.permissions'),
        enableSorting: false,
        cell: ({ row }) => row.original.permissionCodes.length,
      },
      {
        id: 'userCount',
        header: t('roles.userCount'),
        enableSorting: false,
        cell: ({ row }) => row.original.userCount,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
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
            {can('roles:delete') && !row.original.isSystem && (
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
                      onSuccess: async () => {
                        toast.success(t('common.deleted'));
                        await invalidate(getRolesFindAllQueryKey());
                      },
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
        title={t('roles.title')}
        description={t('roles.subtitle')}
        actions={
          <Can permission="roles:create">
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t('roles.new')}
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
      />
      <RoleDialog open={open} onOpenChange={setOpen} role={editing} />
    </>
  );
}
