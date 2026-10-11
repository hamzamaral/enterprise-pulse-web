import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { addDays, format, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight, Copy, Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getShiftPlanFindQueryKey,
  getShiftPlanFindQueryOptions,
  getShiftsFindAllQueryKey,
  useShiftPlanFind,
  useShiftPlanUpdate,
  useShiftsCreate,
  useShiftsFindAll,
  useShiftsUpdate,
} from '@/api/generated/endpoints/attendance/attendance';
import type { ShiftDto, ShiftPlanChangeDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { formatMinutes } from './attendance-components';
import { ColorDot, useDepartmentOptions } from './hr-components';

const ALL = '__all__';
const DEFAULT = '__default__';
const OFF = '__off__';
const ymd = (date: Date) => format(date, 'yyyy-MM-dd');

function weekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => ymd(addDays(weekStart, index)));
}

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function PlanTab() {
  const { t } = useTranslation();
  const can = usePermission();
  const canEdit = can('attendance:update');
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [departmentId, setDepartmentId] = useState(ALL);
  const departments = useDepartmentOptions(can('departments:read'));
  const dates = weekDates(weekStart);
  const params = {
    from: dates[0],
    to: dates[6],
    departmentId: departmentId === ALL ? undefined : departmentId,
  };
  const plan = useShiftPlanFind(params);
  const shifts = useShiftsFindAll();
  const update = useShiftPlanUpdate();
  const shiftById = new Map((shifts.data ?? []).map((shift) => [shift.id, shift]));
  const activeShifts = (shifts.data ?? []).filter((shift) => shift.isActive);

  const entryOf = (employeeId: string, date: string) =>
    plan.data?.entries.find((entry) => entry.employeeId === employeeId && entry.date === date);

  const save = (entries: ShiftPlanChangeDto[], message?: string) =>
    update.mutate(
      { data: { entries } },
      {
        onSuccess: async () => {
          if (message) toast.success(message);
          await invalidate(getShiftPlanFindQueryKey());
        },
      },
    );

  const change = (employeeId: string, date: string, value: string) =>
    save([
      value === DEFAULT
        ? { employeeId, date, useDefault: true }
        : { employeeId, date, shiftId: value === OFF ? null : value },
    ]);

  const copyPreviousWeek = async () => {
    if (!plan.data?.employees.length) return;
    const previous = await queryClient.fetchQuery(
      getShiftPlanFindQueryOptions({
        ...params,
        from: ymd(addDays(weekStart, -7)),
        to: ymd(addDays(weekStart, -1)),
      }),
    );
    const entries = plan.data.employees.flatMap((employee) =>
      dates.map((date, index): ShiftPlanChangeDto => {
        const source = previous.entries.find(
          (entry) =>
            entry.employeeId === employee.id && entry.date === ymd(addDays(weekStart, index - 7)),
        );
        return source
          ? { employeeId: employee.id, date, shiftId: source.shiftId }
          : { employeeId: employee.id, date, useDefault: true };
      }),
    );
    save(entries, t('attendance.weekCopied'));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label={t('attendance.previousWeek')}
            onClick={() => setWeekStart((date) => addDays(date, -7))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
          >
            {t('attendance.thisWeek')}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label={t('attendance.nextWeek')}
            onClick={() => setWeekStart((date) => addDays(date, 7))}
          >
            <ChevronRight />
          </Button>
        </div>
        <span className="text-sm font-medium">
          {formatDate(dates[0], 'dd MMM')} – {formatDate(dates[6], 'dd MMM yyyy')}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {departments.length > 0 && (
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="w-56" aria-label={t('employees.department')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('employees.allDepartments')}</SelectItem>
                {departments.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canEdit && (
            <Button variant="outline" onClick={copyPreviousWeek} disabled={update.isPending}>
              <Copy /> {t('attendance.copyPreviousWeek')}
            </Button>
          )}
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="overflow-x-auto p-0">
          {plan.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="bg-card sticky left-0 z-10 min-w-52 px-3 py-2 text-left font-medium">
                    {t('leave.employee')}
                  </th>
                  {dates.map((date) => (
                    <th
                      key={date}
                      className={cn(
                        'min-w-36 px-1 py-2 text-left font-medium',
                        isWeekend(date) && 'text-muted-foreground',
                      )}
                    >
                      {formatDate(date, 'EEE dd.MM')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {plan.data?.employees.map((employee) => (
                  <tr key={employee.id} className="border-b last:border-0">
                    <td className="bg-card sticky left-0 z-10 px-3 py-1.5">
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-muted-foreground text-xs">
                        {employee.departmentName ?? employee.employeeNo}
                      </div>
                    </td>
                    {dates.map((date) => {
                      const entry = entryOf(employee.id, date);
                      const value = !entry ? DEFAULT : (entry.shiftId ?? OFF);
                      const shift = entry?.shiftId ? shiftById.get(entry.shiftId) : undefined;
                      const defaultLabel = isWeekend(date)
                        ? t('attendance.weekendOff')
                        : t('attendance.standard');
                      return (
                        <td key={date} className="px-1 py-1">
                          <Select
                            value={value}
                            disabled={!canEdit || update.isPending}
                            onValueChange={(next) => change(employee.id, date, next)}
                          >
                            <SelectTrigger
                              size="sm"
                              className={cn(
                                'w-full border-l-4',
                                value === DEFAULT && 'text-muted-foreground',
                              )}
                              style={{ borderLeftColor: shift?.color ?? 'transparent' }}
                              aria-label={`${employee.name} ${date}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={DEFAULT}>{defaultLabel}</SelectItem>
                              <SelectItem value={OFF}>{t('attendance.dayOff')}</SelectItem>
                              {activeShifts.map((option) => (
                                <SelectItem key={option.id} value={option.id}>
                                  {option.name} {option.startTime}–{option.endTime}
                                </SelectItem>
                              ))}
                              {shift && !shift.isActive && (
                                <SelectItem value={shift.id}>{shift.name}</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <p className="text-muted-foreground mt-3 text-xs">{t('attendance.planHint')}</p>
    </>
  );
}

const shiftSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.required'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'validation.required'),
  breakMinutes: z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(0).max(240),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'validation.required'),
  isActive: z.boolean(),
});

function ShiftsTab() {
  const { t } = useTranslation();
  const can = usePermission();
  const canEdit = can('attendance:update');
  const { data, isLoading } = useShiftsFindAll();
  const [editor, setEditor] = useState<{ open: boolean; item: ShiftDto | null }>({
    open: false,
    item: null,
  });
  const invalidate = useInvalidate();
  const create = useShiftsCreate();
  const update = useShiftsUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getShiftsFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<ShiftDto, unknown>[]>(
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
        id: 'hours',
        header: t('attendance.hours'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.startTime}–{row.original.endTime}
            {row.original.endTime <= row.original.startTime && (
              <span className="text-muted-foreground ml-1 text-xs">
                ({t('attendance.nextDay')})
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'break',
        header: t('attendance.breakMinutes'),
        cell: ({ row }) => `${row.original.breakMinutes} ${t('attendance.min')}`,
      },
      {
        id: 'planned',
        header: t('attendance.netWork'),
        cell: ({ row }) => formatMinutes(row.original.plannedMinutes),
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) =>
          canEdit && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.edit')}
                onClick={() => setEditor({ open: true, item: row.original })}
              >
                <Pencil />
              </Button>
            </div>
          ),
      },
    ],
    [t, canEdit],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={
          canEdit && (
            <Button size="sm" onClick={() => setEditor({ open: true, item: null })}>
              <Plus /> {t('attendance.newShift')}
            </Button>
          )
        }
      />
      <SimpleFormDialog<z.infer<typeof shiftSchema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('attendance.newShift')}
        description={<p className="text-muted-foreground text-sm">{t('attendance.shiftHint')}</p>}
        schema={shiftSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          startTime: editor.item?.startTime ?? '08:00',
          endTime: editor.item?.endTime ?? '17:00',
          breakMinutes: editor.item?.breakMinutes ?? 60,
          color: editor.item?.color ?? '#6366f1',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'GND' },
          { name: 'name', label: t('common.name') },
          { name: 'startTime', label: t('attendance.startTime'), type: 'time' },
          { name: 'endTime', label: t('attendance.endTime'), type: 'time' },
          { name: 'breakMinutes', label: t('attendance.breakMinutes'), type: 'number' },
          { name: 'color', label: t('leave.color'), type: 'color' },
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

export function ShiftPlanningPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t('attendance.shiftsTitle')}
        description={t('attendance.shiftsSubtitle')}
      />
      <Tabs defaultValue="plan">
        <TabsList className="mb-4">
          <TabsTrigger value="plan">{t('attendance.weeklyPlan')}</TabsTrigger>
          <TabsTrigger value="shifts">{t('attendance.shiftDefinitions')}</TabsTrigger>
        </TabsList>
        <TabsContent value="plan">
          <PlanTab />
        </TabsContent>
        <TabsContent value="shifts">
          <ShiftsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}
