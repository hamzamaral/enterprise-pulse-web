import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronsUp, Minus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ProjectStatus, ProjectTaskPriority, ProjectTaskStatus } from '@/api/generated/model';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { cn } from '@/shared/lib/utils';

export const PROJECT_STATUSES: ProjectStatus[] = [
  'PLANNED',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
];
/** Statuses in which members log time and charge expenses. */
export const WORKING_STATUSES: ProjectStatus[] = ['PLANNED', 'ACTIVE'];
export const TASK_STATUSES: ProjectTaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
export const TASK_PRIORITIES: ProjectTaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const STATUS_TONES: Record<ProjectStatus, Tone> = {
  PLANNED: 'neutral',
  ACTIVE: 'info',
  ON_HOLD: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const TASK_TONES: Record<ProjectTaskStatus, Tone> = {
  TODO: 'neutral',
  IN_PROGRESS: 'info',
  REVIEW: 'warning',
  DONE: 'success',
};

const PRIORITY_ICONS = { LOW: ArrowDown, MEDIUM: Minus, HIGH: ArrowUp, URGENT: ChevronsUp };
const PRIORITY_COLORS: Record<ProjectTaskPriority, string> = {
  LOW: 'text-muted-foreground',
  MEDIUM: 'text-sky-600',
  HIGH: 'text-amber-600',
  URGENT: 'text-destructive',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`projects.status.${status}`)}</ToneBadge>;
}

export function TaskStatusBadge({ status }: { status: ProjectTaskStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={TASK_TONES[status]}>{t(`projects.taskStatus.${status}`)}</ToneBadge>;
}

export function PriorityIcon({
  priority,
  withLabel,
}: {
  priority: ProjectTaskPriority;
  withLabel?: boolean;
}) {
  const { t } = useTranslation();
  const Icon = PRIORITY_ICONS[priority];
  const label = t(`projects.priority.${priority}`);
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', PRIORITY_COLORS[priority])}>
      <Icon className="size-3.5" aria-label={withLabel ? undefined : label} />
      {withLabel && label}
    </span>
  );
}

/** Done-task share as a thin bar with the percentage. */
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${value}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">%{value}</span>
    </div>
  );
}

/** Cost against budget; turns amber from 80% and red past 100%. */
export function BudgetBar({ usage, className }: { usage: number | null; className?: string }) {
  if (usage === null) return <span className="text-muted-foreground text-xs">—</span>;
  const color = usage > 100 ? 'bg-destructive' : usage >= 80 ? 'bg-amber-500' : 'bg-primary';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      <span
        className={cn(
          'text-xs tabular-nums',
          usage > 100 ? 'text-destructive font-medium' : 'text-muted-foreground',
        )}
      >
        %{usage}
      </span>
    </div>
  );
}

/** Decimal hour strings ("7.50") as "7,5 sa" / "7.5 h". */
export function useFormatHours() {
  const { t, i18n } = useTranslation();
  const formatter = new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: 2,
  });
  return (value: string | number | null | undefined) =>
    value === null || value === undefined
      ? '—'
      : t('projects.hours', { value: formatter.format(Number(value)) });
}

/** Projects, tasks and time plus expense queries, whose project links and costs move together. */
export function useInvalidateProjects() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          (key.startsWith('/api/v1/project') ||
            key.startsWith('/api/v1/time-entries') ||
            key.startsWith('/api/v1/expense'))
        );
      },
    });
}
