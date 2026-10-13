import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarCheck, CheckCircle2, CircleDashed, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ComplianceItemDto,
  ComplianceStatus,
  TrainingEnrollmentStatus,
  TrainingSessionStatus,
} from '@/api/generated/model';
import i18n from '@/i18n';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const SESSION_TONES: Record<TrainingSessionStatus, Tone> = {
  PLANNED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const ENROLLMENT_TONES: Record<TrainingEnrollmentStatus, Tone> = {
  ENROLLED: 'info',
  ATTENDED: 'success',
  NO_SHOW: 'danger',
  CANCELLED: 'neutral',
};

export const COMPLIANCE_TONES: Record<ComplianceStatus, Tone> = {
  VALID: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
  MISSING: 'danger',
};

export function SessionStatusBadge({ status }: { status: TrainingSessionStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={SESSION_TONES[status]}>{t(`training.sessionStatus.${status}`)}</ToneBadge>
  );
}

export function EnrollmentStatusBadge({ status }: { status: TrainingEnrollmentStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={ENROLLMENT_TONES[status]}>
      {t(`training.enrollmentStatus.${status}`)}
    </ToneBadge>
  );
}

export function ComplianceBadge({ status }: { status: ComplianceStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={COMPLIANCE_TONES[status]}>
      {t(`training.compliance.status.${status}`)}
    </ToneBadge>
  );
}

const COMPLIANCE_ICONS = {
  VALID: CheckCircle2,
  EXPIRING: AlertTriangle,
  EXPIRED: XCircle,
  MISSING: CircleDashed,
} as const;

const COMPLIANCE_COLORS: Record<ComplianceStatus, string> = {
  VALID: 'text-emerald-600 dark:text-emerald-400',
  EXPIRING: 'text-amber-600 dark:text-amber-400',
  EXPIRED: 'text-destructive',
  MISSING: 'text-muted-foreground',
};

/** Compact matrix cell: icon plus the expiry date (or the planned session). */
export function ComplianceCell({ item }: { item: ComplianceItemDto }) {
  const { t } = useTranslation();
  const Icon = COMPLIANCE_ICONS[item.status];
  const date = item.expiresAt ?? item.completedAt;
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-xs', COMPLIANCE_COLORS[item.status])}
      title={t(`training.compliance.status.${item.status}`)}
    >
      <Icon className="size-4 shrink-0" />
      <span className="tabular-nums">
        {item.status === 'MISSING' || item.status === 'EXPIRED'
          ? item.scheduledAt
            ? t('training.compliance.scheduled', { date: formatDate(item.scheduledAt) })
            : item.status === 'EXPIRED'
              ? formatDate(date)
              : '—'
          : date
            ? formatDate(date)
            : t('training.compliance.noExpiry')}
      </span>
      {item.status === 'EXPIRING' && item.scheduledAt && (
        <CalendarCheck
          className="text-primary size-3.5 shrink-0"
          aria-label={t('training.compliance.scheduled', { date: formatDate(item.scheduledAt) })}
        >
          <title>
            {t('training.compliance.scheduled', { date: formatDate(item.scheduledAt) })}
          </title>
        </CalendarCheck>
      )}
    </span>
  );
}

/** One decimal in the UI language, e.g. "4,3" or "93,3". */
export function formatDecimal(value: string | number, minimumFractionDigits = 0): string {
  return new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
    minimumFractionDigits,
    maximumFractionDigits: 1,
  }).format(Number(value));
}

export function formatHours(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return i18n.t('training.hoursValue', { value: formatDecimal(value) });
}

/** "09:30 – 17:30" on the same day, otherwise both dates. */
export function formatSessionTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const time = (d: Date) =>
    d.toLocaleTimeString(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  if (start.toDateString() === end.toDateString()) {
    return `${formatDate(start)} ${time(start)} – ${time(end)}`;
  }
  return `${formatDate(start)} ${time(start)} – ${formatDate(end)} ${time(end)}`;
}

/** Every training query; enrollments change session, course and compliance figures alike. */
export function useInvalidateTraining() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['training-courses', 'training-sessions', 'training-enrollments', 'trainings'].some(
            (path) => key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}
