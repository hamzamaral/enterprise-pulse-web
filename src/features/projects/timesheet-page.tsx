import { addDays, format, parseISO } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2, Lock, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useProjectsFindAll,
  useProjectsTasksOf,
  useTimeEntriesSave,
  useTimeEntriesWeek,
} from '@/api/generated/endpoints/projects/projects';
import type { TimeWeekDto } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { WORKING_STATUSES, useFormatHours, useInvalidateProjects } from './project-components';

const GENERAL = '__general__';
const MAX_DAY_HOURS = 24;

interface Row {
  key: string;
  projectId: string;
  projectLabel: string;
  taskId: string | null;
  taskLabel: string | null;
  description: string | null;
  hours: string[];
  locked: boolean;
}

const parseHours = (value: string) => {
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};
const toInput = (value: string) => (Number(value) ? String(Number(value)) : '');
const todayIso = () => format(new Date(), 'yyyy-MM-dd');

function rowsOf(week: TimeWeekDto): Row[] {
  return week.rows.map((row) => ({
    key: `${row.projectId}:${row.taskId ?? ''}`,
    projectId: row.projectId,
    projectLabel: `${row.projectNumber} · ${row.projectName}`,
    taskId: row.taskId,
    taskLabel: row.taskNo ? `#${row.taskNo} ${row.taskTitle}` : null,
    description: row.description,
    hours: row.hours.map(toInput),
    locked: row.locked,
  }));
}

/** Weekly grid of the current user's hours per project and task. */
export function TimesheetPage() {
  const { t, i18n } = useTranslation();
  const { data: me } = useMe();
  const hours = useFormatHours();
  const invalidate = useInvalidateProjects();
  const [date, setDate] = useState(todayIso);
  const { data: week, isFetching } = useTimeEntriesWeek({ date });
  const save = useTimeEntriesSave();
  /** Edits belong to the week they were made on; a refetch or another week starts clean. */
  const [draft, setDraft] = useState<{ week: TimeWeekDto; rows: Row[] } | null>(null);
  const [adding, setAdding] = useState('');
  const { data: projects } = useProjectsFindAll(
    { mine: 'true', open: 'true', pageSize: 100, sortBy: 'number', sortOrder: 'asc' },
    { query: { enabled: !!me?.employeeId } },
  );
  const locale = i18n.resolvedLanguage === 'en' ? enUS : tr;

  const saved = useMemo(() => (week ? rowsOf(week) : []), [week]);
  const rows = draft && draft.week === week ? draft.rows : saved;
  const setRows = (next: (current: Row[]) => Row[]) => week && setDraft({ week, rows: next(rows) });

  const loggable = (projects?.data ?? []).filter((p) => WORKING_STATUSES.includes(p.status));
  const dirty = rows !== saved && JSON.stringify(rows) !== JSON.stringify(saved);
  const dayTotals = (week?.days ?? []).map((_, i) =>
    rows.reduce((sum, row) => sum + (parseHours(row.hours[i] || '0') || 0), 0),
  );
  const invalid = rows.some((row) => row.hours.some((h) => h && Number.isNaN(parseHours(h))));
  const overDay = dayTotals.some((total) => total > MAX_DAY_HOURS);
  const duplicate = new Set(rows.map((r) => r.key)).size !== rows.length;

  if (me && !me.employeeId) {
    return (
      <>
        <PageHeader title={t('projects.timesheet.title')} />
        <p className="text-muted-foreground text-sm">{t('projects.timesheet.noEmployee')}</p>
      </>
    );
  }

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, ...patch };
        return { ...next, key: `${next.projectId}:${next.taskId ?? ''}` };
      }),
    );

  const addRow = (projectId: string) => {
    const project = loggable.find((p) => p.id === projectId);
    if (!project) return;
    setRows((current) => [
      ...current,
      {
        key: `${project.id}:`,
        projectId: project.id,
        projectLabel: `${project.number} · ${project.name}`,
        taskId: null,
        taskLabel: null,
        description: null,
        hours: Array.from({ length: 7 }, () => ''),
        locked: false,
      },
    ]);
    setAdding('');
  };

  const submit = () => {
    if (!week) return;
    save.mutate(
      {
        data: {
          weekStart: week.weekStart,
          rows: rows
            .filter((row) => row.locked || row.hours.some((h) => parseHours(h || '0') > 0))
            .map((row) => ({
              projectId: row.projectId,
              taskId: row.taskId,
              description: row.description,
              hours: row.hours.map((h) => parseHours(h || '0')),
            })),
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('projects.timesheet.saved'));
          await invalidate();
        },
      },
    );
  };

  const shift = (days: number) =>
    week && setDate(format(addDays(parseISO(week.weekStart), days), 'yyyy-MM-dd'));
  const today = todayIso();

  return (
    <>
      <PageHeader
        title={t('projects.timesheet.title')}
        description={t('projects.timesheet.subtitle')}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label={t('projects.timesheet.previous')}
              disabled={dirty || !week}
              onClick={() => shift(-7)}
            >
              <ChevronLeft />
            </Button>
            <Button variant="outline" disabled={dirty || !week} onClick={() => setDate(todayIso())}>
              {t('projects.timesheet.thisWeek')}
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label={t('projects.timesheet.next')}
              disabled={dirty || !week}
              onClick={() => shift(7)}
            >
              <ChevronRight />
            </Button>
          </div>
        }
      />
      <Card>
        <CardContent className="pt-6">
          {!week ? (
            <Skeleton className="h-64" />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {format(parseISO(week.days[0]), 'd MMM', { locale })} –{' '}
                  {format(parseISO(week.days[6]), 'd MMM yyyy', { locale })}
                  {isFetching && <Loader2 className="ml-2 inline size-4 animate-spin" />}
                </h2>
                <span className="text-muted-foreground text-sm">
                  {t('projects.timesheet.weekTotal', {
                    hours: hours(dayTotals.reduce((a, b) => a + b, 0)),
                  })}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="text-muted-foreground border-b text-xs">
                      <th className="py-2 text-left font-medium">{t('projects.project')}</th>
                      <th className="py-2 text-left font-medium">{t('projects.time.task')}</th>
                      {week.days.map((day) => (
                        <th
                          key={day}
                          className={cn(
                            'w-16 py-2 text-center font-medium',
                            day === today && 'text-primary',
                          )}
                        >
                          <div className="capitalize">
                            {format(parseISO(day), 'EEE', { locale })}
                          </div>
                          <div className="tabular-nums">{format(parseISO(day), 'd.MM')}</div>
                        </th>
                      ))}
                      <th className="w-16 py-2 text-right font-medium">
                        {t('projects.timesheet.total')}
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => {
                      const total = row.hours.reduce((s, h) => s + (parseHours(h || '0') || 0), 0);
                      return (
                        <tr key={index} className="border-b align-middle">
                          <td className="max-w-56 py-2 pr-2">
                            <div className="flex items-center gap-1 truncate font-medium">
                              {row.locked && (
                                <Lock
                                  className="text-muted-foreground size-3.5 shrink-0"
                                  aria-label={t('projects.timesheet.locked')}
                                />
                              )}
                              <span className="truncate" title={row.projectLabel}>
                                {row.projectLabel}
                              </span>
                            </div>
                          </td>
                          <td className="w-56 py-2 pr-2">
                            {row.locked ? (
                              <span className="text-muted-foreground">
                                {row.taskLabel ?? t('projects.time.general')}
                              </span>
                            ) : (
                              <TaskSelect
                                projectId={row.projectId}
                                value={row.taskId}
                                label={row.taskLabel}
                                onChange={(taskId) => update(index, { taskId })}
                              />
                            )}
                          </td>
                          {row.hours.map((value, day) => (
                            <td key={day} className="px-1 py-2">
                              <Input
                                value={value}
                                inputMode="decimal"
                                disabled={row.locked}
                                aria-label={`${row.projectLabel} ${week.days[day]}`}
                                className={cn(
                                  'h-8 px-1 text-center tabular-nums',
                                  value && Number.isNaN(parseHours(value)) && 'border-destructive',
                                )}
                                onChange={(event) =>
                                  update(index, {
                                    hours: row.hours.map((h, i) =>
                                      i === day ? event.target.value : h,
                                    ),
                                  })
                                }
                              />
                            </td>
                          ))}
                          <td className="py-2 text-right font-medium tabular-nums">
                            {hours(total)}
                          </td>
                          <td className="py-2 text-right">
                            {!row.locked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground size-7"
                                aria-label={t('common.delete')}
                                onClick={() =>
                                  setRows((current) => current.filter((_, i) => i !== index))
                                }
                              >
                                <Trash2 />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {!rows.length && (
                      <tr>
                        <td colSpan={11} className="text-muted-foreground py-8 text-center">
                          {t('projects.timesheet.empty')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="text-xs font-medium">
                      <td colSpan={2} className="py-2">
                        {t('projects.timesheet.dayTotal')}
                      </td>
                      {dayTotals.map((total, i) => (
                        <td
                          key={i}
                          className={cn(
                            'py-2 text-center tabular-nums',
                            total > MAX_DAY_HOURS && 'text-destructive',
                          )}
                        >
                          {total ? hours(total) : '—'}
                        </td>
                      ))}
                      <td className="py-2 text-right tabular-nums">
                        {hours(dayTotals.reduce((a, b) => a + b, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Select value={adding} onValueChange={addRow}>
                  <SelectTrigger className="w-72">
                    <Plus className="size-4" />
                    <SelectValue placeholder={t('projects.timesheet.addRow')} />
                  </SelectTrigger>
                  <SelectContent>
                    {loggable.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.number} · {p.name}
                      </SelectItem>
                    ))}
                    {!loggable.length && (
                      <div className="text-muted-foreground px-2 py-1.5 text-sm">
                        {t('projects.timesheet.noProjects')}
                      </div>
                    )}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  {(overDay || duplicate) && (
                    <span className="text-destructive text-sm">
                      {overDay
                        ? t('projects.timesheet.overDay', { max: MAX_DAY_HOURS })
                        : t('projects.timesheet.duplicate')}
                    </span>
                  )}
                  {dirty && (
                    <Button variant="outline" onClick={() => setDraft(null)}>
                      {t('projects.timesheet.discard')}
                    </Button>
                  )}
                  <Button
                    disabled={!dirty || invalid || overDay || duplicate || save.isPending}
                    onClick={submit}
                  >
                    {save.isPending && <Loader2 className="animate-spin" />}
                    {t('common.save')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function TaskSelect({
  projectId,
  value,
  label,
  onChange,
}: {
  projectId: string;
  value: string | null;
  /** Shown until the project's tasks have loaded. */
  label: string | null;
  onChange: (taskId: string | null) => void;
}) {
  const { t } = useTranslation();
  const { data: tasks } = useProjectsTasksOf(projectId, undefined, {
    query: { staleTime: 60_000 },
  });
  const options = (tasks ?? []).filter((task) => task.status !== 'DONE' || task.id === value);
  return (
    <Select
      value={value ?? GENERAL}
      onValueChange={(next) => onChange(next === GENERAL ? null : next)}
    >
      <SelectTrigger className="h-8 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={GENERAL}>{t('projects.time.general')}</SelectItem>
        {options.map((task) => (
          <SelectItem key={task.id} value={task.id}>
            #{task.taskNo} {task.title}
          </SelectItem>
        ))}
        {value && label && !options.some((task) => task.id === value) && (
          <SelectItem value={value}>{label}</SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
