import { useQueryClient } from '@tanstack/react-query';
import { FileText, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useCandidatesFindAll,
  useJobPostingsFindAll,
} from '@/api/generated/endpoints/recruitment/recruitment';
import type {
  ApplicationStage,
  CandidateSource,
  DownloadUrlDto,
  InterviewRecommendation,
  InterviewStatus,
  JobOfferStatus,
  JobPostingStatus,
} from '@/api/generated/model';
import { getErrorMessage } from '@/api/http';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

export const ACTIVE_STAGES: ApplicationStage[] = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER'];
export const CLOSED_STAGES: ApplicationStage[] = ['HIRED', 'REJECTED', 'WITHDRAWN'];
export const isActiveStage = (stage: ApplicationStage) => ACTIVE_STAGES.includes(stage);

const STAGE_TONES: Record<ApplicationStage, Tone> = {
  APPLIED: 'neutral',
  SCREENING: 'info',
  INTERVIEW: 'warning',
  OFFER: 'warning',
  HIRED: 'success',
  REJECTED: 'danger',
  WITHDRAWN: 'neutral',
};

const POSTING_TONES: Record<JobPostingStatus, Tone> = {
  DRAFT: 'neutral',
  OPEN: 'success',
  ON_HOLD: 'warning',
  CLOSED: 'info',
};

const INTERVIEW_TONES: Record<InterviewStatus, Tone> = {
  SCHEDULED: 'info',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

const OFFER_TONES: Record<JobOfferStatus, Tone> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  DECLINED: 'danger',
  WITHDRAWN: 'neutral',
};

const RECOMMENDATION_TONES: Record<InterviewRecommendation, Tone> = {
  STRONG_YES: 'success',
  YES: 'success',
  NO: 'danger',
  STRONG_NO: 'danger',
};

export function ApplicationStageBadge({ stage }: { stage: ApplicationStage }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STAGE_TONES[stage]}>{t(`recruitment.stages.${stage}`)}</ToneBadge>;
}

export function PostingStatusBadge({ status }: { status: JobPostingStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={POSTING_TONES[status]}>{t(`recruitment.postingStatus.${status}`)}</ToneBadge>
  );
}

export function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={INTERVIEW_TONES[status]}>
      {t(`recruitment.interviewStatus.${status}`)}
    </ToneBadge>
  );
}

export function OfferStatusBadge({ status }: { status: JobOfferStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={OFFER_TONES[status]}>{t(`recruitment.offerStatus.${status}`)}</ToneBadge>;
}

export function RecommendationBadge({ value }: { value: InterviewRecommendation }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={RECOMMENDATION_TONES[value]}>
      {t(`recruitment.recommendations.${value}`)}
    </ToneBadge>
  );
}

export function SourceLabel({ source }: { source: CandidateSource }) {
  const { t } = useTranslation();
  return <>{t(`recruitment.sources.${source}`)}</>;
}

/** Read-only stars, or a picker when `onChange` is given. */
export function Rating({
  value,
  onChange,
  size = 'sm',
  label,
}: {
  value: number | null;
  onChange?: (value: number) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const icon = size === 'md' ? 'size-5' : 'size-3.5';
  return (
    <span className="inline-flex items-center gap-0.5" role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value !== null && n <= Math.round(value);
        const star = (
          <Star
            className={cn(
              icon,
              filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
            )}
          />
        );
        return onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={label ? `${label}: ${n}` : String(n)}
            onClick={() => onChange(n)}
            className="hover:scale-110"
          >
            {star}
          </button>
        ) : (
          <span key={n}>{star}</span>
        );
      })}
    </span>
  );
}

export function salaryRange(min: string | null, max: string | null, currency: string): string {
  if (min && max) return `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
  if (min || max) return formatMoney(min ?? max, currency);
  return '—';
}

/** Every recruitment query; pipeline actions touch postings, candidates and interviews alike. */
export function useInvalidateRecruitment() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['job-postings', 'candidates', 'job-applications', 'interviews', 'job-offers'].some(
            (path) => key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}

/** Opens the signed CV URL; the tab is opened first so popup blockers allow it. */
export function CvButton({
  load,
  name,
  className,
}: {
  load: () => Promise<DownloadUrlDto>;
  name?: string | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const open = async () => {
    const tab = window.open('', '_blank');
    try {
      const { url } = await load();
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Button variant="outline" size="sm" className={className} onClick={() => void open()}>
      <FileText />
      <span className="max-w-48 truncate">{name ?? t('recruitment.candidates.cv')}</span>
    </Button>
  );
}

/** Postings that take applications (open or on hold). */
export function useActivePostingOptions(enabled = true): SelectOption[] {
  const { data } = useJobPostingsFindAll(
    { active: 'true', pageSize: 100, sortBy: 'number', sortOrder: 'desc' },
    { query: { enabled } },
  );
  return (data?.data ?? [])
    .filter((p) => p.status === 'OPEN')
    .map((p) => ({ value: p.id, label: `${p.number} · ${p.title}` }));
}

export function useCandidateOptions(enabled = true): SelectOption[] {
  const { data } = useCandidatesFindAll(
    { pageSize: 100, sortBy: 'firstName', sortOrder: 'asc' },
    { query: { enabled } },
  );
  return (data?.data ?? []).map((c) => ({
    value: c.id,
    label: c.currentTitle ? `${c.fullName} · ${c.currentTitle}` : c.fullName,
  }));
}
