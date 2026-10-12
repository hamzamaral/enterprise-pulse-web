import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getUsersFindAllQueryKey,
  useUsersFindAll,
  useUsersRemove,
  usersFindAll,
} from '@/api/generated/endpoints/users/users';
import type { UserDto, UsersFindAllIsActive } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatDateTime, initials } from '@/shared/lib/format';
import { fetchAllPages, tableQuery, useInvalidate } from '@/shared/lib/query';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { UserFormDialog } from './user-form-dialog';

const ALL = 'all';

export function UsersPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState<string>(ALL);
  const [editing, setEditing] = useState<UserDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const invalidate = useInvalidate();
  const remove = useUsersRemove();

  const params = {
    ...table.params,
    isActive: status === ALL ? undefined : (status as UsersFindAllIsActive),
  };
  const { data, isLoading } = useUsersFindAll(params, { query: tableQuery });

  const openDialog = (user: UserDto | null) => {
    setEditing(user);
    setDialogOpen(true);
  };

  const columns = useMemo<ColumnDef<UserDto, unknown>[]>(
    () => [
      {
        id: 'firstName',
        header: t('users.fullName'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {initials(row.original.firstName, row.original.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-medium">
                {row.original.firstName} {row.original.lastName}
                {row.original.isSuperAdmin && (
                  <ShieldCheck
                    className="text-primary size-3.5"
                    aria-label={t('users.superAdmin')}
                  />
                )}
              </div>
              <div className="text-muted-foreground truncate text-xs">{row.original.email}</div>
            </div>
          </div>
        ),
      },
      {
        id: 'roles',
        header: t('users.roles'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.roles.map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: 'isActive',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'twoFactorEnabled',
        header: t('users.twoFactor'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.twoFactorEnabled ? <ToneBadge tone="info">2FA</ToneBadge> : null,
      },
      {
        id: 'lastLoginAt',
        header: t('users.lastLogin'),
        cell: ({ row }) =>
          row.original.lastLoginAt ? formatDateTime(row.original.lastLoginAt) : t('users.never'),
      },
      {
        id: 'actions',
        header: '',
        size: 48,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) =>
          can('users:update') || can('users:delete') ? (
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
                {can('users:update') && (
                  <DropdownMenuItem onSelect={() => openDialog(row.original)}>
                    <Pencil /> {t('common.edit')}
                  </DropdownMenuItem>
                )}
                {can('users:delete') && (
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
                            await invalidate(getUsersFindAllQueryKey());
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

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => usersFindAll({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      'users',
      [
        { header: t('users.firstName'), value: (u) => u.firstName },
        { header: t('users.lastName'), value: (u) => u.lastName },
        { header: t('common.email'), value: (u) => u.email },
        { header: t('users.roles'), value: (u) => u.roles.map((r) => r.name).join(', ') },
        {
          header: t('common.status'),
          value: (u) => (u.isActive ? t('common.active') : t('common.inactive')),
        },
        {
          header: t('users.lastLogin'),
          value: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt) : null),
        },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('users.title')}
        description={t('users.subtitle')}
        actions={
          <Can permission="users:create">
            <Button onClick={() => openDialog(null)}>
              <Plus /> {t('users.new')}
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
        onExport={handleExport}
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('common.all')}</SelectItem>
              <SelectItem value="true">{t('common.active')}</SelectItem>
              <SelectItem value="false">{t('common.inactive')}</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <UserFormDialog open={dialogOpen} onOpenChange={setDialogOpen} user={editing} />
    </>
  );
}
