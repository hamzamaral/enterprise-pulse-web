import { CalendarClock, Loader2, MapPin, MessageSquarePlus, UserCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useTrainingEnrollmentsFeedback,
  useTrainingSessionsCancelSelf,
  useTrainingSessionsEnrollSelf,
  useTrainingSessionsOpen,
  useTrainingsMine,
} from '@/api/generated/endpoints/training/training';
import type { MyTrainingDto, OpenTrainingSessionDto } from '@/api/generated/model';
import { Rating } from '@/features/recruitment/recruitment-components';
import { KpiCard } from '@/features/reports/report-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { Textarea } from '@/shared/ui/textarea';
import {
  ComplianceBadge,
  EnrollmentStatusBadge,
  formatHours,
  formatSessionTime,
  useInvalidateTraining,
} from './training-components';

export function MyTrainingsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useTrainingsMine();
  const { data: open } = useTrainingSessionsOpen();
  const [feedbackFor, setFeedbackFor] = useState<MyTrainingDto | null>(null);

  const upcoming = (data?.trainings ?? [])
    .filter((r) => r.sessionStatus === 'PLANNED' && r.status === 'ENROLLED')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const history = (data?.trainings ?? []).filter((r) => !upcoming.includes(r));
  const available = (open ?? []).filter((s) => !s.enrolled);
  const validCount =
    data?.mandatory.filter((m) => m.status === 'VALID' || m.status === 'EXPIRING').length ?? 0;
  const pendingFeedback = history.filter((r) => r.canGiveFeedback).length;

  return (
    <>
      <PageHeader title={t('training.my.title')} description={t('training.my.subtitle')} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={t('training.summary.hoursThisYear')}
          value={data && formatHours(data.hoursThisYear)}
        />
        <KpiCard
          label={t('training.my.mandatory')}
          value={data && `${validCount} / ${data.mandatory.length}`}
          tone={data && validCount < data.mandatory.length ? 'negative' : undefined}
          hint={t('training.my.mandatoryHint')}
        />
        <KpiCard
          label={t('training.my.upcoming')}
          value={data && upcoming.length}
          hint={upcoming[0] && `${upcoming[0].courseTitle} · ${formatDate(upcoming[0].startsAt)}`}
        />
      </div>

      {!!data?.mandatory.length && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">{t('training.my.certificates')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.mandatory.map((item, index) => {
              const course = data.courses[index];
              return (
                <div key={item.courseId} className="rounded-md border p-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-medium">{course?.title}</span>
                    <ComplianceBadge status={item.status} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {item.expiresAt
                      ? t('training.my.validUntil', { date: formatDate(item.expiresAt) })
                      : item.completedAt
                        ? t('training.my.completedOn', { date: formatDate(item.completedAt) })
                        : t('training.my.notTaken')}
                  </p>
                  {item.scheduledAt && (
                    <p className="text-primary mt-1 text-xs">
                      {t('training.compliance.scheduled', { date: formatDate(item.scheduledAt) })}
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="upcoming">
        <TabsList>
          <TabsTrigger value="upcoming">
            {t('training.my.upcoming')} ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            {t('training.my.history')}
            {pendingFeedback > 0 && (
              <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs tabular-nums">
                {pendingFeedback}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open">
            {t('training.my.open')} ({available.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-3">
          {isLoading && <Skeleton className="h-24" />}
          {data && !upcoming.length && <Empty text={t('training.my.noUpcoming')} />}
          {upcoming.map((row) => (
            <TrainingRow key={row.id} row={row} />
          ))}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {data && !history.length && <Empty text={t('training.my.noHistory')} />}
          {history.map((row) => (
            <TrainingRow key={row.id} row={row} onFeedback={() => setFeedbackFor(row)} />
          ))}
        </TabsContent>
        <TabsContent value="open" className="space-y-3">
          {open && !available.length && <Empty text={t('training.my.noOpen')} />}
          {available.map((session) => (
            <OpenSessionRow key={session.id} session={session} />
          ))}
        </TabsContent>
      </Tabs>

      <FeedbackDialog row={feedbackFor} onClose={() => setFeedbackFor(null)} />
    </>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="text-muted-foreground py-10 text-center text-sm">{text}</CardContent>
    </Card>
  );
}

function SessionMeta({
  row,
}: {
  row: Pick<MyTrainingDto, 'startsAt' | 'endsAt' | 'location' | 'durationHours'>;
}) {
  return (
    <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1">
        <CalendarClock className="size-3.5" /> {formatSessionTime(row.startsAt, row.endsAt)}
      </span>
      {row.location && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5" /> {row.location}
        </span>
      )}
      <span>{formatHours(row.durationHours)}</span>
    </div>
  );
}

function TrainingRow({ row, onFeedback }: { row: MyTrainingDto; onFeedback?: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const cancelSelf = useTrainingSessionsCancelSelf();
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="min-w-56 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {row.courseTitle}
            {row.isMandatory && (
              <Badge variant="outline" className="text-xs font-normal">
                {t('training.courses.mandatory')}
              </Badge>
            )}
          </div>
          <SessionMeta row={row} />
          {row.feedbackComment && (
            <p className="text-muted-foreground text-xs italic">“{row.feedbackComment}”</p>
          )}
        </div>
        {row.score !== null && (
          <span className="text-sm tabular-nums">
            {t('training.sessions.score')}: {row.score}
          </span>
        )}
        {row.certificateExpiresAt && (
          <span className="text-muted-foreground text-xs">
            {t('training.my.validUntil', { date: formatDate(row.certificateExpiresAt) })}
          </span>
        )}
        {row.feedbackRating !== null && <Rating value={row.feedbackRating} />}
        <EnrollmentStatusBadge status={row.status} />
        {row.canGiveFeedback && onFeedback && (
          <Button size="sm" variant="outline" onClick={onFeedback}>
            <MessageSquarePlus /> {t('training.my.giveFeedback')}
          </Button>
        )}
        {row.canCancel && (
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline" disabled={cancelSelf.isPending}>
                <X /> {t('training.my.cancelSeat')}
              </Button>
            }
            title={t('training.my.cancelSeatTitle')}
            description={t('training.my.cancelSeatDescription', { course: row.courseTitle })}
            confirmLabel={t('training.my.cancelSeat')}
            onConfirm={() =>
              cancelSelf.mutate(
                { id: row.sessionId },
                {
                  onSuccess: async () => {
                    toast.success(t('training.my.seatCancelled'));
                    await invalidate();
                  },
                },
              )
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

function OpenSessionRow({ session }: { session: OpenTrainingSessionDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const enrollSelf = useTrainingSessionsEnrollSelf();
  const full = session.seatsLeft === 0;
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 py-4">
        <div className="min-w-56 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 font-medium">
            {session.courseTitle}
            <Badge variant="secondary" className="text-xs font-normal">
              {t(`training.categories.${session.category}`)}
            </Badge>
          </div>
          <SessionMeta row={session} />
          {session.description && (
            <p className="text-muted-foreground max-w-2xl text-xs">{session.description}</p>
          )}
        </div>
        <span className="text-muted-foreground text-sm">
          {session.seatsLeft === null
            ? t('training.sessions.unlimitedSeats')
            : t('training.sessions.seatsLeft', { count: session.seatsLeft })}
        </span>
        <Button
          size="sm"
          disabled={full || enrollSelf.isPending}
          onClick={() =>
            enrollSelf.mutate(
              { id: session.id },
              {
                onSuccess: async () => {
                  toast.success(t('training.my.enrolled', { course: session.courseTitle }));
                  await invalidate();
                },
              },
            )
          }
        >
          {enrollSelf.isPending ? <Loader2 className="animate-spin" /> : <UserCheck />}
          {full ? t('training.my.full') : t('training.my.enroll')}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeedbackDialog({ row, onClose }: { row: MyTrainingDto | null; onClose: () => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {row && <FeedbackForm row={row} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function FeedbackForm({ row, onClose }: { row: MyTrainingDto; onClose: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const feedback = useTrainingEnrollmentsFeedback();
  const [rating, setRating] = useState<number | null>(row.feedbackRating);
  const [comment, setComment] = useState(row.feedbackComment ?? '');

  const submit = () => {
    if (rating === null) return;
    feedback.mutate(
      { id: row.id, data: { rating, comment: comment.trim() || null } },
      {
        onSuccess: async () => {
          toast.success(t('training.my.feedbackSaved'));
          await invalidate();
          onClose();
        },
      },
    );
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{row.courseTitle}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('training.my.rating')}</Label>
          <Rating value={rating} onChange={setRating} size="md" label={t('training.my.rating')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="training-feedback">{t('training.sessions.feedbackComment')}</Label>
          <Textarea
            id="training-feedback"
            rows={4}
            maxLength={2000}
            value={comment}
            placeholder={t('training.my.feedbackPlaceholder')}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={rating === null || feedback.isPending} onClick={submit}>
          {feedback.isPending && <Loader2 className="animate-spin" />}
          {t('common.save')}
        </Button>
      </DialogFooter>
    </>
  );
}
