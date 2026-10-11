import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getHolidaysFindAllQueryKey,
  getLeaveBalancesFindAllQueryKey,
  getLeaveTypesFindAllQueryKey,
  useHolidaysCreate,
  useHolidaysFindAll,
  useHolidaysRemove,
  useLeaveBalancesAccrue,
  useLeaveBalancesFindAll,
  useLeaveBalancesUpdate,
  useLeaveTypesCreate,
  useLeaveTypesFindAll,
  useLeaveTypesUpdate,
} from '@/api/generated/endpoints/leave/leave';
import type { HolidayDto, LeaveBalanceDto, LeaveTypeDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ColorDot } from './hr-components';

const number = () => z.coerce.number({ invalid_type_error: 'validation.number' });
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

function YearSelect({ value, onChange }: { value: number; onChange: (year: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(year) => onChange(Number(year))}>
      <SelectTrigger className="w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {YEARS.map((year) => (
          <SelectItem key={year} value={String(year)}>
            {year}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-end">
      <Button variant="ghost" size="icon" className="size-8" aria-label={label} onClick={onClick}>
        {children}
      </Button>
    </div>
  );
}

const typeSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  defaultDays: number().int().min(0).max(365),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.required'),
  isPaid: z.boolean(),
  requiresBalance: z.boolean(),
  isActive: z.boolean(),
});

function LeaveTypesTab() {
  const { t } = useTranslation();
  const { data, isLoading } = useLeaveTypesFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: LeaveTypeDto | null }>({
    open: false,
    item: null,
  });
  const invalidate = useInvalidate();
  const create = useLeaveTypesCreate();
  const update = useLeaveTypesUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getLeaveTypesFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<LeaveTypeDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            <ColorDot color={row.original.color} />
            {row.original.name}
            <code className="text-muted-foreground text-xs font-normal">{row.original.code}</code>
          </span>
        ),
      },
      {
        id: 'defaultDays',
        header: t('leave.defaultDays'),
        cell: ({ row }) => row.original.defaultDays,
      },
      {
        id: 'flags',
        header: '',
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            <ToneBadge tone={row.original.isPaid ? 'info' : 'neutral'}>
              {row.original.isPaid ? t('leave.isPaid') : t('leave.unpaid')}
            </ToneBadge>
            {row.original.requiresBalance && (
              <ToneBadge tone="neutral">{t('leave.requiresBalance')}</ToneBadge>
            )}
          </div>
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
          <IconButton
            label={t('common.edit')}
            onClick={() => setEditor({ open: true, item: row.original })}
          >
            <Pencil />
          </IconButton>
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
            <Plus /> {t('leave.newType')}
          </Button>
        }
      />
      <SimpleFormDialog<z.infer<typeof typeSchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('leave.newType')}
        schema={typeSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          defaultDays: editor.item?.defaultDays ?? 0,
          color: editor.item?.color ?? '#6366f1',
          isPaid: editor.item?.isPaid ?? true,
          requiresBalance: editor.item?.requiresBalance ?? false,
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'YILLIK' },
          { name: 'name', label: t('common.name') },
          { name: 'defaultDays', label: t('leave.defaultDays'), type: 'number' },
          { name: 'color', label: t('leave.color'), type: 'color' },
          { name: 'isPaid', label: t('leave.isPaid'), type: 'switch' },
          { name: 'requiresBalance', label: t('leave.requiresBalance'), type: 'switch' },
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

const balanceSchema = z.object({ entitledDays: number().int().min(0).max(365) });

function BalancesTab() {
  const { t } = useTranslation();
  const [year, setYear] = useState(CURRENT_YEAR);
  const { data, isLoading } = useLeaveBalancesFindAll({ year });
  const [editing, setEditing] = useState<LeaveBalanceDto | null>(null);
  const invalidate = useInvalidate();
  const accrue = useLeaveBalancesAccrue();
  const update = useLeaveBalancesUpdate();

  const columns = useMemo<ColumnDef<LeaveBalanceDto, unknown>[]>(
    () => [
      {
        id: 'employee',
        header: t('leave.employee'),
        cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
      },
      {
        id: 'type',
        header: t('leave.type'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <ColorDot color={row.original.leaveTypeColor} />
            {row.original.leaveTypeName}
          </span>
        ),
      },
      { id: 'entitled', header: t('leave.entitled'), cell: ({ row }) => row.original.entitledDays },
      { id: 'used', header: t('leave.used'), cell: ({ row }) => row.original.usedDays },
      { id: 'pending', header: t('leave.pending'), cell: ({ row }) => row.original.pendingDays },
      {
        id: 'remaining',
        header: t('leave.remaining'),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{row.original.remainingDays}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <IconButton label={t('leave.editBalance')} onClick={() => setEditing(row.original)}>
            <Pencil />
          </IconButton>
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
          <>
            <YearSelect value={year} onChange={setYear} />
            <Button
              size="sm"
              variant="outline"
              disabled={accrue.isPending}
              onClick={() =>
                accrue.mutate(
                  { data: { year } },
                  {
                    onSuccess: async (result) => {
                      toast.success(t('leave.accrued', { count: result.created }));
                      await invalidate(getLeaveBalancesFindAllQueryKey());
                    },
                  },
                )
              }
            >
              <RefreshCw /> {t('leave.accrue')}
            </Button>
          </>
        }
      />
      <SimpleFormDialog<z.infer<typeof balanceSchema>>
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `${editing.employeeName} · ${editing.leaveTypeName}` : ''}
        schema={balanceSchema}
        pending={update.isPending}
        defaultValues={{ entitledDays: editing?.entitledDays ?? 0 }}
        fields={[{ name: 'entitledDays', label: t('leave.entitled'), type: 'number' }]}
        onSubmit={(values) =>
          editing &&
          update.mutate(
            { id: editing.id, data: values },
            {
              onSuccess: async () => {
                toast.success(t('common.saved'));
                await invalidate(getLeaveBalancesFindAllQueryKey());
                setEditing(null);
              },
            },
          )
        }
      />
    </>
  );
}

const holidaySchema = z.object({ date: v.requiredString(), name: v.requiredString() });

function HolidaysTab() {
  const { t } = useTranslation();
  const [year, setYear] = useState(CURRENT_YEAR);
  const { data, isLoading } = useHolidaysFindAll({ year });
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidate();
  const create = useHolidaysCreate();
  const remove = useHolidaysRemove();

  const columns = useMemo<ColumnDef<HolidayDto, unknown>[]>(
    () => [
      {
        id: 'date',
        header: t('leave.date'),
        cell: ({ row }) => formatDate(row.original.date, 'dd MMMM yyyy, EEEE'),
      },
      { id: 'name', header: t('common.name'), cell: ({ row }) => row.original.name },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <ConfirmDialog
            trigger={
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive size-8"
                  aria-label={t('common.delete')}
                >
                  <Trash2 />
                </Button>
              </div>
            }
            onConfirm={() =>
              remove.mutate(
                { id: row.original.id },
                {
                  onSuccess: async () => {
                    toast.success(t('common.deleted'));
                    await invalidate(getHolidaysFindAllQueryKey());
                  },
                },
              )
            }
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          <>
            <YearSelect value={year} onChange={setYear} />
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> {t('leave.newHoliday')}
            </Button>
          </>
        }
      />
      <SimpleFormDialog<z.infer<typeof holidaySchema>>
        open={open}
        onOpenChange={setOpen}
        title={t('leave.newHoliday')}
        schema={holidaySchema}
        pending={create.isPending}
        defaultValues={{ date: `${year}-01-01`, name: '' }}
        fields={[
          { name: 'date', label: t('leave.date'), type: 'date' },
          { name: 'name', label: t('common.name') },
        ]}
        onSubmit={(values) =>
          create.mutate(
            { data: values },
            {
              onSuccess: async () => {
                toast.success(t('common.saved'));
                await invalidate(getHolidaysFindAllQueryKey());
                setOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}

export function LeaveSettingsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('leave.settingsTitle')} description={t('leave.settingsSubtitle')} />
      <Tabs defaultValue="types">
        <TabsList className="mb-4">
          <TabsTrigger value="types">{t('leave.types')}</TabsTrigger>
          <TabsTrigger value="balances">{t('leave.balances')}</TabsTrigger>
          <TabsTrigger value="holidays">{t('leave.holidays')}</TabsTrigger>
        </TabsList>
        <TabsContent value="types">
          <LeaveTypesTab />
        </TabsContent>
        <TabsContent value="balances">
          <BalancesTab />
        </TabsContent>
        <TabsContent value="holidays">
          <HolidaysTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
