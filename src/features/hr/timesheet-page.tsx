import { Download } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAttendanceTimesheet } from '@/api/generated/endpoints/attendance/attendance';
import type { TimesheetDayDto, TimesheetRowDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  AttendanceRecordDialog,
  currentMonth,
  DayCell,
  DayLegend,
  formatMinutes,
} from './attendance-components';
import { useDepartmentOptions } from './hr-components';

const ALL = '__all__';

function isWeekend(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={cn('text-2xl font-semibold tabular-nums', tone)}>{value}</p>
      </CardContent>
    </Card>
  );
}

/** Monthly timesheet (puantaj): one row per employee, one cell per day. */
export function TimesheetPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const canEdit = can('attendance:update');
  const [month, setMonth] = useState(currentMonth);
  const [departmentId, setDepartmentId] = useState(ALL);
  const departments = useDepartmentOptions(can('departments:read'));
  const [editing, setEditing] = useState<{
    employeeId: string;
    employeeName: string;
    day: TimesheetDayDto;
  } | null>(null);
  const { data, isLoading } = useAttendanceTimesheet({
    month,
    departmentId: departmentId === ALL ? undefined : departmentId,
  });

  const rows = data?.rows ?? [];
  const sum = (pick: (row: TimesheetRowDto) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  const exportRows = () =>
    exportToExcel(
      `${t('attendance.timesheetFile')}-${month}`,
      [
        { header: t('employees.employeeNo'), value: (row: TimesheetRowDto) => row.employeeNo },
        { header: t('leave.employee'), value: (row) => row.employeeName },
        { header: t('employees.department'), value: (row) => row.departmentName },
        { header: t('attendance.plannedDays'), value: (row) => row.totals.plannedDays },
        { header: t('attendance.presentDays'), value: (row) => row.totals.presentDays },
        { header: t('attendance.lateDays'), value: (row) => row.totals.lateDays },
        { header: t('attendance.absentDays'), value: (row) => row.totals.absentDays },
        { header: t('attendance.leaveDays'), value: (row) => row.totals.leaveDays },
        {
          header: t('attendance.plannedHours'),
          value: (row) => Math.round(row.totals.plannedMinutes / 6) / 10,
        },
        {
          header: t('attendance.workedHours'),
          value: (row) => Math.round(row.totals.workedMinutes / 6) / 10,
        },
        {
          header: t('attendance.overtimeHours'),
          value: (row) => Math.round(row.totals.overtimeMinutes / 6) / 10,
        },
        ...(data?.days ?? []).map((date, index) => ({
          header: formatDate(date, 'dd.MM'),
          value: (row: TimesheetRowDto) => {
            const day = row.days[index];
            return day.checkIn
              ? `${day.checkIn}-${day.checkOut ?? ''}`
              : t(`attendance.short.${day.status}`);
          },
        })),
      ],
      rows,
    );

  return (
    <>
      <PageHeader
        title={t('attendance.timesheetTitle')}
        description={t('attendance.timesheetSubtitle')}
        actions={
          <Button variant="outline" onClick={exportRows} disabled={!rows.length}>
            <Download /> {t('common.export')}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="month"
          className="w-44"
          aria-label={t('attendance.month')}
          value={month}
          onChange={(event) => event.target.value && setMonth(event.target.value)}
        />
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
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label={t('attendance.employees')} value={String(rows.length)} />
        <SummaryCard
          label={t('attendance.workedHours')}
          value={formatMinutes(sum((row) => row.totals.workedMinutes))}
        />
        <SummaryCard
          label={t('attendance.overtimeHours')}
          value={formatMinutes(sum((row) => row.totals.overtimeMinutes))}
        />
        <SummaryCard
          label={t('attendance.lateDays')}
          value={String(sum((row) => row.totals.lateDays))}
          tone="text-amber-600 dark:text-amber-400"
        />
        <SummaryCard
          label={t('attendance.absentDays')}
          value={String(sum((row) => row.totals.absentDays))}
          tone="text-red-600 dark:text-red-400"
        />
      </div>

      <Card className="py-0">
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : !rows.length ? (
            <p className="text-muted-foreground p-6 text-center text-sm">{t('common.noResults')}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b">
                  <th className="bg-card sticky left-0 z-10 min-w-52 px-3 py-2 text-left font-medium">
                    {t('leave.employee')}
                  </th>
                  {data?.days.map((date) => (
                    <th
                      key={date}
                      className={cn(
                        'px-0.5 py-1 text-center text-[11px] font-medium',
                        isWeekend(date) && 'text-muted-foreground',
                        date === data.today && 'text-primary',
                      )}
                    >
                      <div>{formatDate(date, 'd')}</div>
                      <div className="font-normal">{formatDate(date, 'EEEEEE')}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {t('attendance.worked')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {t('attendance.overtime')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {t('attendance.lateShort')}
                  </th>
                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                    {t('attendance.absentShort')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.employeeId} className="hover:bg-muted/40 border-b last:border-0">
                    <td className="bg-card sticky left-0 z-10 px-3 py-1.5">
                      <div className="font-medium">{row.employeeName}</div>
                      <div className="text-muted-foreground text-xs">
                        {row.departmentName ?? row.employeeNo}
                      </div>
                    </td>
                    {row.days.map((day) => (
                      <td key={day.date} className="px-0.5 py-1">
                        <DayCell
                          day={day}
                          isToday={day.date === data?.today}
                          onClick={
                            canEdit
                              ? () =>
                                  setEditing({
                                    employeeId: row.employeeId,
                                    employeeName: row.employeeName,
                                    day,
                                  })
                              : undefined
                          }
                        />
                      </td>
                    ))}
                    <td className="px-3 text-right tabular-nums">
                      {formatMinutes(row.totals.workedMinutes)}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {row.totals.overtimeMinutes ? formatMinutes(row.totals.overtimeMinutes) : '—'}
                    </td>
                    <td className="px-3 text-right tabular-nums">{row.totals.lateDays || '—'}</td>
                    <td className="px-3 text-right tabular-nums">{row.totals.absentDays || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <div className="mt-3">
        <DayLegend />
      </div>
      <AttendanceRecordDialog target={editing} onOpenChange={(open) => !open && setEditing(null)} />
    </>
  );
}
