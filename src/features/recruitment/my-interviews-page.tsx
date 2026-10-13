import { Link } from '@tanstack/react-router';
import { CalendarClock, Clock, Loader2, MapPin, MessageSquare, Users } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  interviewsCvUrl,
  useInterviewsFeedback,
  useInterviewsMine,
} from '@/api/generated/endpoints/recruitment/recruitment';
import { InterviewRecommendation, type MyInterviewDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import {
  CvButton,
  InterviewStatusBadge,
  Rating,
  RecommendationBadge,
  useInvalidateRecruitment,
} from './recruitment-components';

type Filter = 'pending' | 'upcoming' | 'all';

/** Interviews the signed-in employee takes part in; feedback needs no recruitment permission. */
export function MyInterviewsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<Filter>('pending');
  const [answering, setAnswering] = useState<MyInterviewDto | null>(null);
  const { data, isLoading } = useInterviewsMine();
  const [now] = useState(() => Date.now());

  const pending = (data ?? []).filter(
    (i) => i.canGiveFeedback && !i.mySubmittedAt && new Date(i.scheduledAt).getTime() <= now,
  );
  const upcoming = (data ?? [])
    .filter((i) => i.status === 'SCHEDULED' && new Date(i.scheduledAt).getTime() > now)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const rows = filter === 'pending' ? pending : filter === 'upcoming' ? upcoming : (data ?? []);

  return (
    <>
      <PageHeader
        title={t('recruitment.myInterviews.title')}
        description={t('recruitment.myInterviews.subtitle')}
      />
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">
            {t('recruitment.myInterviews.pending')}
            {pending.length > 0 && (
              <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 text-xs tabular-nums">
                {pending.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">{t('recruitment.myInterviews.upcoming')}</TabsTrigger>
          <TabsTrigger value="all">{t('common.all')}</TabsTrigger>
        </TabsList>
      </Tabs>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : rows.length ? (
        <div className="space-y-3">
          {rows.map((interview) => (
            <InterviewCard
              key={interview.id}
              interview={interview}
              now={now}
              onFeedback={() => setAnswering(interview)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            {t(`recruitment.myInterviews.empty.${filter}`)}
          </CardContent>
        </Card>
      )}
      <Dialog open={!!answering} onOpenChange={(open) => !open && setAnswering(null)}>
        <DialogContent>
          {answering && <FeedbackForm interview={answering} onClose={() => setAnswering(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function InterviewCard({
  interview,
  now,
  onFeedback,
}: {
  interview: MyInterviewDto;
  now: number;
  onFeedback: () => void;
}) {
  const { t } = useTranslation();
  const can = usePermission();
  const past = new Date(interview.scheduledAt).getTime() <= now;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {can('recruitment:read') ? (
              <Link
                to="/recruitment/applications/$id"
                params={{ id: interview.applicationId }}
                className="font-semibold hover:underline"
              >
                {interview.candidateName}
              </Link>
            ) : (
              <span className="font-semibold">{interview.candidateName}</span>
            )}
            <InterviewStatusBadge status={interview.status} />
          </div>
          <div className="text-muted-foreground text-sm">
            {interview.postingTitle}
            {interview.candidateTitle && ` · ${interview.candidateTitle}`}
          </div>
          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {formatDateTime(interview.scheduledAt)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {t(`recruitment.interviewTypes.${interview.type}`)} ·{' '}
              {t('recruitment.interviews.minutes', { count: interview.durationMinutes })}
            </span>
            {interview.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {interview.location}
              </span>
            )}
            {interview.otherInterviewers.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {interview.otherInterviewers.join(', ')}
              </span>
            )}
          </div>
          {interview.notes && (
            <p className="text-muted-foreground text-xs whitespace-pre-line">{interview.notes}</p>
          )}
          {interview.mySubmittedAt && (
            <div className="flex flex-wrap items-center gap-2 pt-1 text-sm">
              <span className="text-muted-foreground text-xs">
                {t('recruitment.myInterviews.yourFeedback')}:
              </span>
              <Rating value={interview.myRating} />
              {interview.myRecommendation && (
                <RecommendationBadge value={interview.myRecommendation} />
              )}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {interview.hasCv && <CvButton load={() => interviewsCvUrl(interview.id)} />}
          {interview.canGiveFeedback && (past || interview.mySubmittedAt) && (
            <Button
              size="sm"
              variant={interview.mySubmittedAt ? 'outline' : 'default'}
              onClick={onFeedback}
            >
              <MessageSquare />
              {interview.mySubmittedAt
                ? t('recruitment.myInterviews.editFeedback')
                : t('recruitment.myInterviews.giveFeedback')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const RECOMMENDATIONS = Object.values(InterviewRecommendation);

function FeedbackForm({ interview, onClose }: { interview: MyInterviewDto; onClose: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const save = useInterviewsFeedback();
  const [rating, setRating] = useState<number | null>(interview.myRating);
  const [recommendation, setRecommendation] = useState<InterviewRecommendation | null>(
    interview.myRecommendation,
  );
  const [feedback, setFeedback] = useState(interview.myFeedback ?? '');
  const valid = rating !== null && recommendation !== null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('recruitment.myInterviews.feedbackTitle')}</DialogTitle>
        <DialogDescription>
          {interview.candidateName} · {interview.postingTitle}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('recruitment.myInterviews.rating')}</Label>
          <Rating
            value={rating}
            onChange={setRating}
            size="md"
            label={t('recruitment.myInterviews.rating')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('recruitment.myInterviews.recommendation')}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
            {RECOMMENDATIONS.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={recommendation === value}
                onClick={() => setRecommendation(value)}
                className={cn(
                  'rounded-md border px-2 py-2 text-sm transition-colors',
                  recommendation === value
                    ? value.endsWith('YES')
                      ? 'border-emerald-500 bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400'
                      : 'border-destructive bg-destructive/10 text-destructive font-medium'
                    : 'hover:bg-muted',
                )}
              >
                {t(`recruitment.recommendations.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-feedback">{t('recruitment.myInterviews.comments')}</Label>
          <Textarea
            id="interview-feedback"
            rows={4}
            value={feedback}
            placeholder={t('recruitment.myInterviews.commentsHint')}
            onChange={(e) => setFeedback(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          disabled={!valid || save.isPending}
          onClick={() =>
            valid &&
            save.mutate(
              {
                id: interview.id,
                data: { rating, recommendation, feedback: feedback.trim() || null },
              },
              {
                onSuccess: async () => {
                  toast.success(t('recruitment.myInterviews.feedbackSaved'));
                  await invalidate();
                  onClose();
                },
              },
            )
          }
        >
          {save.isPending && <Loader2 className="animate-spin" />}
          {t('recruitment.myInterviews.submit')}
        </Button>
      </DialogFooter>
    </>
  );
}
