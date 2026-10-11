import { LogIn, LogOut, UserX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getAttendanceMineQueryKey,
  getAttendanceTimesheetQueryKey,
  useAttendanceCheckIn,
  useAttendanceCheckOut,
  useAttendanceMine,
} from '@/api/generated/endpoints/attendance/attendance';
import type { MyAttendanceDto } from '@/api/generated/model';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { AttendanceStatusBadge, currentMonth, formatMinutes } from './attendance-components';

function TodayCard({ data }: { data: MyAttendanceDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const checkIn = useAttendanceCheckIn();
  const checkOut = useAttendanceCheckOut();
  const onSuccess = (message: string) => async () => {
    toast.success(message);
    await invalidate(getAttendanceMineQueryKey(), getAttendanceTimesheetQueryKey());
  };
  const { today } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span>{formatDate(today.date, 'dd MMMM yyyy, EEEE')}</span>
          <AttendanceStatusBadge status={today.status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground text-xs">{t('attendance.planned')}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {today.plannedStart ? `${today.plannedStart}–${today.plannedEnd}` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{t('attendance.checkIn')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{today.checkIn ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{t('attendance.checkOut')}</dt>
            <dd className="text-lg font-semibold tabular-nums">{today.checkOut ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">{t('attendance.worked')}</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {today.workedMinutes ? formatMinutes(today.workedMinutes) : '—'}
            </dd>
          </div>
        </dl>
        <div className="flex gap-2">
          <Button
            size="lg"
            disabled={!data.canCheckIn || checkIn.isPending}
            onClick={() =>
              checkIn.mutate(undefined, { onSuccess: onSuccess(t('attendance.checkedIn')) })
            }
          >
            <LogIn /> {t('attendance.doCheckIn')}
          </Button>
          <Button
            size="lg"
            variant="outline"
            disabled={!data.canCheckOut || checkOut.isPending}
            onClick={() =>
              checkOut.mutate(undefined, { onSuccess: onSuccess(t('attendance.checkedOut')) })
            }
          >
            <LogOut /> {t('attendance.doCheckOut')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <Card className="py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className={cn('text-2xl font-semibold tabular-nums', className)}>{value}</p>
      </CardContent>
    </Card>
  );
}

/** Self-service attendance: clock in / out and the month at a glance. */
export function MyAttendancePage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth);
  const { data, isLoading, isError } = useAttendanceMine({ month }, { query: { retry: false } });
  const totals = data?.row.totals;
  const days = (data?.row.days ?? []).filter(
    (day) =>
      day.date <= (data?.today.date ?? '') &&
      day.status !== 'UPCOMING' &&
      (day.status !== 'OFF' || day.checkIn),
  );

  return (
    <>
      <PageHeader title={t('attendance.myTitle')} description={t('attendance.mySubtitle')} />
      {isError ? (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-3 text-sm">
            <UserX className="size-5" />
            {t('leave.noEmployee')}
          </CardContent>
        </Card>
      ) : isLoading || !data || !totals ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <div className="space-y-6">
          <TodayCard data={data} />
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-medium">{t('attendance.monthSummary')}</h2>
              <Input
                type="month"
                className="w-44"
                aria-label={t('attendance.month')}
                value={month}
                onChange={(event) => event.target.value && setMonth(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label={t('attendance.workedHours')}
                value={`${formatMinutes(totals.workedMinutes)} / ${formatMinutes(totals.plannedMinutes)}`}
              />
              <Stat
                label={t('attendance.overtimeHours')}
                value={formatMinutes(totals.overtimeMinutes)}
              />
              <Stat
                label={t('attendance.lateDays')}
                value={String(totals.lateDays)}
                className={totals.lateDays ? 'text-amber-600 dark:text-amber-400' : undefined}
              />
              <Stat
                label={t('attendance.absentDays')}
                value={String(totals.absentDays)}
                className={totals.absentDays ? 'text-red-600 dark:text-red-400' : undefined}
              />
            </div>
            <Card className="py-0">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('leave.date')}</TableHead>
                      <TableHead>{t('attendance.planned')}</TableHead>
                      <TableHead>{t('attendance.checkIn')}</TableHead>
                      <TableHead>{t('attendance.checkOut')}</TableHead>
                      <TableHead className="text-right">{t('attendance.worked')}</TableHead>
                      <TableHead className="text-right">{t('attendance.overtime')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {days.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground h-20 text-center">
                          {t('common.noResults')}
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...days].reverse().map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{formatDate(day.date, 'dd MMM, EEE')}</TableCell>
                          <TableCell className="tabular-nums">
                            {day.plannedStart ? `${day.plannedStart}–${day.plannedEnd}` : '—'}
                          </TableCell>
                          <TableCell className="tabular-nums">{day.checkIn ?? '—'}</TableCell>
                          <TableCell className="tabular-nums">{day.checkOut ?? '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {day.workedMinutes ? formatMinutes(day.workedMinutes) : '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {day.overtimeMinutes ? formatMinutes(day.overtimeMinutes) : '—'}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2">
                              <AttendanceStatusBadge status={day.status} />
                              {day.lateMinutes > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  +{day.lateMinutes} {t('attendance.min')}
                                </span>
                              )}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
