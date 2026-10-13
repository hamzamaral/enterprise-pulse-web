import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PerformanceReviewStatus, ReviewCycleStatus } from '@/api/generated/model';
import i18n from '@/i18n';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { cn } from '@/shared/lib/utils';

export const SCORE_BANDS = [1, 2, 3, 4, 5] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

const CYCLE_TONES: Record<ReviewCycleStatus, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'info',
  CLOSED: 'success',
};

const REVIEW_TONES: Record<PerformanceReviewStatus, Tone> = {
  SELF_REVIEW: 'warning',
  MANAGER_REVIEW: 'info',
  COMPLETED: 'success',
};

const BAND_TONES: Record<ScoreBand, Tone> = {
  1: 'danger',
  2: 'warning',
  3: 'info',
  4: 'success',
  5: 'success',
};

/** Same rounding as the API: halves go up (3.5 → 4). */
export function scoreBand(score: number | string): ScoreBand {
  return Math.min(5, Math.max(1, Math.floor(Number(score) + 0.5))) as ScoreBand;
}

export function formatScore(score: string | number | null | undefined): string {
  if (score === null || score === undefined || score === '') return '—';
  return new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(score));
}

export function CycleStatusBadge({ status }: { status: ReviewCycleStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={CYCLE_TONES[status]}>{t(`performance.cycleStatus.${status}`)}</ToneBadge>;
}

export function ReviewStatusBadge({ status }: { status: PerformanceReviewStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={REVIEW_TONES[status]}>{t(`performance.reviewStatus.${status}`)}</ToneBadge>
  );
}

/** Score with its band, e.g. "4,04 · Beklentinin üzerinde". */
export function ScoreBadge({ score }: { score: string | null }) {
  const { t } = useTranslation();
  if (score === null) return <span className="text-muted-foreground">—</span>;
  const band = scoreBand(score);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-medium tabular-nums">{formatScore(score)}</span>
      <ToneBadge tone={BAND_TONES[band]}>{t(`performance.bands.${band}`)}</ToneBadge>
    </span>
  );
}

export function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('bg-muted h-2 w-24 overflow-hidden rounded-full', className)}>
      <div className="bg-primary h-full rounded-full" style={{ width: `${value}%` }} />
    </div>
  );
}

/** Every performance query; review actions change cycle statistics too. */
export function useInvalidatePerformance() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['review-cycles', 'performance-reviews', 'performance-goals', 'competencies'].some(
            (path) => key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}
