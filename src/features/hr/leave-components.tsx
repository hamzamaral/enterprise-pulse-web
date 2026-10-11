import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarDays, ExternalLink, Loader2, MoreHorizontal, XCircle } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getLeaveBalancesFindAllQueryKey,
  getLeaveRequestsFindAllQueryKey,
  useLeaveRequestsCancel,
  useLeaveRequestsCreate,
  useLeaveRequestsWorkingDays,
  useLeaveTypesFindAll,
} from '@/api/generated/endpoints/leave/leave';
import type { LeaveBalanceDto, LeaveRequestDto } from '@/api/generated/model';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable, type PageMeta } from '@/shared/components/data-table/data-table';
import type { TableState } from '@/shared/components/data-table/use-table-state';
import { formatDate } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import { ColorDot, LeaveStatusBadge, useEmployeeOptions } from './hr-components';

const schema = z
  .object({
    employeeId: z.string(),
    leaveTypeId: v.requiredString(),
    startDate: v.requiredString(),
    endDate: v.requiredString(),
    reason: z.string(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'validation.dateRange',
  });
type FormValues = z.infer<typeof schema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface LeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lets HR pick the employee (requires `leave:create`). */
  onBehalf?: boolean;
}

export function LeaveRequestDialog({ open, onOpenChange, onBehalf }: LeaveRequestDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const create = useLeaveRequestsCreate();
  const { data: types } = useLeaveTypesFindAll({ query: { enabled: open } });
  const employeeOptions = useEmployeeOptions(open && !!onBehalf);
  const activeTypes = (types ?? []).filter((type) => type.isActive);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const [startDate, endDate] = useWatch({ control: form.control, name: ['startDate', 'endDate'] });
  const validRange =
    ISO_DATE.test(startDate ?? '') && ISO_DATE.test(endDate ?? '') && endDate >= startDate;
  const { data: preview, isFetching } = useLeaveRequestsWorkingDays(
    { startDate, endDate },
    { query: { enabled: open && validRange } },
  );

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    form.reset({ employeeId: '', leaveTypeId: '', startDate: today, endDate: today, reason: '' });
  }, [open, form]);

  const onSubmit = (values: FormValues) => {
    if (onBehalf && !values.employeeId) {
      form.setError('employeeId', { message: 'validation.required' });
      return;
    }
    create.mutate(
      {
        data: {
          leaveTypeId: values.leaveTypeId,
          startDate: values.startDate,
          endDate: values.endDate,
          reason: values.reason || undefined,
          employeeId: onBehalf ? values.employeeId : undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('leave.created'));
          await invalidate(getLeaveRequestsFindAllQueryKey(), getLeaveBalancesFindAllQueryKey());
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('leave.newRequest')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {onBehalf && (
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('leave.employee')}</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employeeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="leaveTypeId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('leave.type')}</FormLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {activeTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <ColorDot color={type.color} />
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('leave.startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('leave.endDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" min={startDate} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {validRange && (
              <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm">
                <CalendarDays className="size-4" />
                {isFetching || !preview ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  t('leave.workingDays', { count: preview.days })
                )}
              </div>
            )}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('leave.reason')}</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface LeaveRequestsTableProps {
  data?: LeaveRequestDto[];
  meta?: PageMeta;
  isLoading: boolean;
  state?: TableState;
  toolbar?: React.ReactNode;
  showEmployee?: boolean;
  searchable?: boolean;
}

export function LeaveRequestsTable({
  data,
  meta,
  isLoading,
  state,
  toolbar,
  showEmployee,
  searchable,
}: LeaveRequestsTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const invalidate = useInvalidate();
  const cancel = useLeaveRequestsCancel();

  const columns = useMemo<ColumnDef<LeaveRequestDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('leave.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      ...(showEmployee
        ? [
            {
              id: 'employee',
              header: t('leave.employee'),
              enableSorting: false,
              cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
            } as ColumnDef<LeaveRequestDto, unknown>,
          ]
        : []),
      {
        id: 'type',
        header: t('leave.type'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="flex items-center gap-2">
            <ColorDot color={row.original.leaveTypeColor} />
            {row.original.leaveTypeName}
          </span>
        ),
      },
      {
        id: 'startDate',
        header: t('leave.startDate'),
        cell: ({ row }) =>
          `${formatDate(row.original.startDate)} – ${formatDate(row.original.endDate)}`,
      },
      {
        id: 'days',
        header: t('leave.days'),
        enableSorting: false,
        cell: ({ row }) => t('leave.daysValue', { count: row.original.days }),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <LeaveStatusBadge status={row.original.status} />,
      },
      {
        id: 'actions',
        header: '',
        size: 48,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.workflowInstanceId || row.original.canCancel ? (
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
                {row.original.workflowInstanceId && (
                  <DropdownMenuItem
                    onSelect={() =>
                      router.history.push(`/workflow/instances/${row.original.workflowInstanceId}`)
                    }
                  >
                    <ExternalLink /> {t('leave.viewApproval')}
                  </DropdownMenuItem>
                )}
                {row.original.canCancel && (
                  <ConfirmDialog
                    title={t('leave.cancelTitle')}
                    description={t('leave.cancelDescription')}
                    confirmLabel={t('leave.cancel')}
                    trigger={
                      <DropdownMenuItem variant="destructive" onSelect={(e) => e.preventDefault()}>
                        <XCircle /> {t('leave.cancel')}
                      </DropdownMenuItem>
                    }
                    onConfirm={() =>
                      cancel.mutate(
                        { id: row.original.id, data: {} },
                        {
                          onSuccess: async () => {
                            toast.success(t('leave.cancelled'));
                            await invalidate(
                              getLeaveRequestsFindAllQueryKey(),
                              getLeaveBalancesFindAllQueryKey(),
                            );
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
    [t, showEmployee],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      isLoading={isLoading}
      state={state}
      toolbar={toolbar}
      searchable={searchable}
    />
  );
}

export function BalanceCards({
  balances,
  isLoading,
}: {
  balances?: LeaveBalanceDto[];
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }
  if (!balances?.length) {
    return <p className="text-muted-foreground text-sm">{t('leave.noBalances')}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {balances.map((b) => {
        const usedPct = b.entitledDays ? Math.min(100, (b.usedDays / b.entitledDays) * 100) : 0;
        const pendingPct = b.entitledDays
          ? Math.min(100 - usedPct, (b.pendingDays / b.entitledDays) * 100)
          : 0;
        return (
          <Card key={b.id}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium">
                  <ColorDot color={b.leaveTypeColor} />
                  {b.leaveTypeName}
                </span>
                <span className="text-muted-foreground text-xs">{b.year}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold tabular-nums">{b.remainingDays}</span>
                <span className="text-muted-foreground text-sm">
                  / {b.entitledDays} {t('leave.remaining').toLocaleLowerCase()}
                </span>
              </div>
              <div className="bg-muted flex h-2 overflow-hidden rounded-full">
                <div style={{ width: `${usedPct}%`, background: b.leaveTypeColor }} />
                <div
                  className="opacity-40"
                  style={{ width: `${pendingPct}%`, background: b.leaveTypeColor }}
                />
              </div>
              <div className="text-muted-foreground flex justify-between text-xs">
                <span>
                  {t('leave.used')}: {b.usedDays}
                </span>
                <span>
                  {t('leave.pending')}: {b.pendingDays}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
