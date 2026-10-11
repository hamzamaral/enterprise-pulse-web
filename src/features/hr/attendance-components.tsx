import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAttendanceMineQueryKey,
  getAttendanceTimesheetQueryKey,
  useAttendanceUpdateRecord,
} from '@/api/generated/endpoints/attendance/attendance';
import type { AttendanceDayStatus, TimesheetDayDto } from '@/api/generated/model';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';

export const DAY_TONES: Record<AttendanceDayStatus, Tone> = {
  PRESENT: 'success',
  LATE: 'warning',
  ABSENT: 'danger',
  INCOMPLETE: 'info',
  LEAVE: 'info',
  HOLIDAY: 'neutral',
  OFF: 'neutral',
  UPCOMING: 'neutral',
};

const CELL_CLASSES: Record<AttendanceDayStatus, string> = {
  PRESENT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  LATE: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  ABSENT: 'bg-red-500/15 text-red-700 dark:text-red-400',
  INCOMPLETE: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
  LEAVE: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  HOLIDAY: 'bg-muted text-muted-foreground',
  OFF: 'text-muted-foreground/60',
  UPCOMING: 'text-muted-foreground/60',
};

/** Minutes as "H:MM" (e.g. 450 → "7:30"). */
export function formatMinutes(minutes: number): string {
  const sign = minutes < 0 ? '-' : '';
  const value = Math.abs(minutes);
  return `${sign}${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`;
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function AttendanceStatusBadge({ status }: { status: AttendanceDayStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={DAY_TONES[status]}>{t(`attendance.status.${status}`)}</ToneBadge>;
}

/** Tooltip text summarizing a day: plan, actual times and deviations. */
export function useDayTitle() {
  const { t } = useTranslation();
  return (day: TimesheetDayDto) =>
    [
      `${formatDate(day.date, 'dd MMMM EEEE')} · ${t(`attendance.status.${day.status}`)}`,
      day.plannedStart && `${t('attendance.planned')}: ${day.plannedStart}–${day.plannedEnd}`,
      day.checkIn && `${t('attendance.actual')}: ${day.checkIn}–${day.checkOut ?? '…'}`,
      day.lateMinutes > 0 && `${t('attendance.late')}: ${day.lateMinutes} ${t('attendance.min')}`,
      day.overtimeMinutes > 0 &&
        `${t('attendance.overtime')}: ${formatMinutes(day.overtimeMinutes)}`,
      day.note,
    ]
      .filter(Boolean)
      .join('\n');
}

export function DayCell({
  day,
  isToday,
  onClick,
}: {
  day: TimesheetDayDto;
  isToday?: boolean;
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const title = useDayTitle()(day);
  const workedOffDay = (day.status === 'OFF' || day.status === 'HOLIDAY') && day.checkIn;
  const className = cn(
    'flex size-7 items-center justify-center rounded text-[11px] font-semibold',
    workedOffDay ? CELL_CLASSES.PRESENT : CELL_CLASSES[day.status],
    isToday && 'ring-primary ring-2',
    onClick && 'hover:ring-ring cursor-pointer hover:ring-2',
  );
  const label = workedOffDay ? '+' : t(`attendance.short.${day.status}`);
  return onClick ? (
    <button type="button" className={className} title={title} aria-label={title} onClick={onClick}>
      {label}
    </button>
  ) : (
    <span className={className} title={title}>
      {label}
    </span>
  );
}

export function DayLegend() {
  const { t } = useTranslation();
  const statuses: AttendanceDayStatus[] = [
    'PRESENT',
    'LATE',
    'ABSENT',
    'INCOMPLETE',
    'LEAVE',
    'HOLIDAY',
    'OFF',
  ];
  return (
    <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
      {statuses.map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn(
              'flex size-5 items-center justify-center rounded text-[10px] font-semibold',
              CELL_CLASSES[status],
            )}
          >
            {t(`attendance.short.${status}`)}
          </span>
          {t(`attendance.status.${status}`)}
        </span>
      ))}
    </div>
  );
}

const clock = z.union([z.literal(''), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]);
const recordSchema = z
  .object({ checkIn: clock, checkOut: clock, note: z.string().max(500) })
  .refine((value) => !value.checkOut || value.checkIn, {
    path: ['checkIn'],
    message: 'validation.required',
  });

/** HR correction of one employee day. */
export function AttendanceRecordDialog({
  target,
  onOpenChange,
}: {
  target: { employeeId: string; employeeName: string; day: TimesheetDayDto } | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const update = useAttendanceUpdateRecord();
  const day = target?.day;
  return (
    <SimpleFormDialog<z.infer<typeof recordSchema>>
      open={!!target}
      onOpenChange={onOpenChange}
      title={
        target ? `${target.employeeName} · ${formatDate(target.day.date, 'dd MMMM EEEE')}` : ''
      }
      description={
        day && (
          <p className="text-muted-foreground text-sm">
            {day.plannedStart
              ? `${t('attendance.planned')}: ${day.plannedStart}–${day.plannedEnd}`
              : t('attendance.status.OFF')}
            {' · '}
            {t('attendance.editHint')}
          </p>
        )
      }
      schema={recordSchema}
      pending={update.isPending}
      defaultValues={{
        checkIn: day?.checkIn ?? '',
        checkOut: day?.checkOut ?? '',
        note: day?.note ?? '',
      }}
      fields={[
        { name: 'checkIn', label: t('attendance.checkIn'), type: 'time' },
        { name: 'checkOut', label: t('attendance.checkOut'), type: 'time' },
        { name: 'note', label: t('common.notes'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        target &&
        update.mutate(
          {
            data: {
              employeeId: target.employeeId,
              date: target.day.date,
              checkIn: values.checkIn || null,
              checkOut: values.checkOut || null,
              note: values.note,
            },
          },
          {
            onSuccess: async () => {
              toast.success(t('common.saved'));
              await invalidate(getAttendanceTimesheetQueryKey(), getAttendanceMineQueryKey());
              onOpenChange(false);
            },
          },
        )
      }
    />
  );
}
