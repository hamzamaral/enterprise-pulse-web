import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  Ban,
  CalendarPlus,
  Check,
  FileSignature,
  Loader2,
  Pencil,
  RotateCcw,
  Trash2,
  Undo2,
  UserCheck,
  X,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  candidatesCvUrl,
  useInterviewsCancel,
  useJobApplicationsAddNote,
  useJobApplicationsFindOne,
  useJobApplicationsMove,
  useJobApplicationsRemove,
  useJobApplicationsReject,
  useJobApplicationsReopen,
  useJobApplicationsUpdate,
  useJobApplicationsWithdraw,
  useJobOffersAccept,
  useJobOffersDecline,
  useJobOffersWithdraw,
} from '@/api/generated/endpoints/recruitment/recruitment';
import type {
  ApplicationActivityDto,
  InterviewDto,
  InterviewStatus,
  JobApplicationDetailDto,
  JobOfferStatus,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ReasonDialog } from '@/features/crm/crm-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import { InterviewFormDialog } from './interview-form-dialog';
import { HireDialog, OfferDialog } from './offer-dialogs';
import {
  ACTIVE_STAGES,
  ApplicationStageBadge,
  CvButton,
  InterviewStatusBadge,
  OfferStatusBadge,
  Rating,
  RecommendationBadge,
  useInvalidateRecruitment,
} from './recruitment-components';

export function ApplicationPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidateRecruitment();
  const [scheduling, setScheduling] = useState(false);
  const [offering, setOffering] = useState(false);
  const [hiring, setHiring] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const { data: app, isLoading } = useJobApplicationsFindOne(id);
  const move = useJobApplicationsMove();
  const update = useJobApplicationsUpdate();
  const reject = useJobApplicationsReject();
  const withdraw = useJobApplicationsWithdraw();
  const reopen = useJobApplicationsReopen();
  const remove = useJobApplicationsRemove();

  if (!app) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const done = async (message: string) => {
    toast.success(message);
    await invalidate();
  };
  const liveOffer = app.offers.some((o) => o.status === 'PENDING' || o.status === 'ACCEPTED');
  const currentIndex = ACTIVE_STAGES.indexOf(app.stage);
  const pending =
    move.isPending ||
    reject.isPending ||
    withdraw.isPending ||
    reopen.isPending ||
    update.isPending;

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('recruitment.applications.deleted'));
          await navigate({ to: '/recruitment/$id', params: { id: app.postingId } });
          await invalidate();
        },
      },
    );

  return (
    <>
      <Link
        to="/recruitment/$id"
        params={{ id: app.postingId }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {app.postingTitle}
      </Link>
      <PageHeader
        title={app.candidateName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{app.postingNumber}</code>
            <ApplicationStageBadge stage={app.stage} />
            {app.candidateTitle && (
              <span className="text-muted-foreground text-sm">{app.candidateTitle}</span>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {app.canEdit && (
              <>
                <Button variant="outline" onClick={() => setScheduling(true)}>
                  <CalendarPlus /> {t('recruitment.interviews.schedule')}
                </Button>
                {!liveOffer && (
                  <Button variant="outline" onClick={() => setOffering(true)}>
                    <FileSignature /> {t('recruitment.offers.new')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setRejecting(true)}
                >
                  <Ban /> {t('recruitment.applications.reject')}
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" disabled={pending}>
                      <Undo2 /> {t('recruitment.applications.withdraw')}
                    </Button>
                  }
                  title={t('recruitment.applications.withdrawTitle')}
                  description={t('recruitment.applications.withdrawDescription')}
                  confirmLabel={t('recruitment.applications.withdraw')}
                  onConfirm={() =>
                    withdraw.mutate(
                      { id },
                      { onSuccess: () => done(t('recruitment.applications.withdrawn')) },
                    )
                  }
                />
              </>
            )}
            {app.canHire && (
              <Button onClick={() => setHiring(true)}>
                <UserCheck /> {t('recruitment.hire.action')}
              </Button>
            )}
            {app.canReopen && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  reopen.mutate(
                    { id },
                    { onSuccess: () => done(t('recruitment.applications.reopened')) },
                  )
                }
              >
                <RotateCcw /> {t('recruitment.applications.reopen')}
              </Button>
            )}
            {app.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={onDelete}
              />
            )}
          </div>
        }
      />

      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[...ACTIVE_STAGES, 'HIRED' as const].map((stage, index) => {
          const reached = app.stage === 'HIRED' || (currentIndex !== -1 && index <= currentIndex);
          const current = stage === app.stage;
          const clickable = app.canEdit && stage !== 'HIRED' && !current;
          return (
            <li key={stage}>
              <button
                type="button"
                disabled={!clickable || pending}
                onClick={() =>
                  move.mutate(
                    { id, data: { stage, position: 10_000 } },
                    { onSuccess: () => void invalidate() },
                  )
                }
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  reached
                    ? stage === 'HIRED'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-primary/40 bg-primary/10 text-primary'
                    : 'text-muted-foreground',
                  current && 'border-primary font-semibold',
                  clickable && 'hover:border-primary/60 cursor-pointer',
                )}
              >
                <span className="text-xs opacity-70">{index + 1}.</span>{' '}
                {t(`recruitment.stages.${stage}`)}
              </button>
            </li>
          );
        })}
      </ol>
      {(app.stage === 'REJECTED' || app.stage === 'WITHDRAWN') && (
        <p className="border-destructive/30 bg-destructive/5 mb-4 rounded-lg border p-3 text-sm">
          {t(`recruitment.applications.closedNotice.${app.stage}`, {
            date: formatDate(app.stageChangedAt),
          })}
          {app.rejectReason && <span className="block font-medium">{app.rejectReason}</span>}
        </p>
      )}
      {app.stage === 'HIRED' && app.employeeId && (
        <p className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-800 dark:text-emerald-300">
          {t('recruitment.applications.hiredNotice', { date: formatDate(app.hiredAt) })}{' '}
          {can('employees:read') ? (
            <Link
              to="/hr/employees/$id"
              params={{ id: app.employeeId }}
              className="font-mono font-medium underline"
            >
              {app.employeeNo}
            </Link>
          ) : (
            <code>{app.employeeNo}</code>
          )}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <CandidateCard app={app} />
          <InterviewsCard app={app} />
          <OffersCard app={app} />
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('recruitment.applications.evaluation')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('recruitment.applications.recruiterRating')}
                </span>
                <Rating
                  value={app.rating}
                  size="md"
                  label={t('recruitment.applications.recruiterRating')}
                  onChange={
                    app.canEdit
                      ? (rating) =>
                          update.mutate(
                            { id, data: { rating } },
                            { onSuccess: () => void invalidate() },
                          )
                      : undefined
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('recruitment.applications.interviewRating')}
                </span>
                <span className="inline-flex items-center gap-2">
                  <Rating value={app.feedback.averageRating} />
                  <span className="tabular-nums">{app.feedback.averageRating ?? '—'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">
                  {t('recruitment.applications.recommendationScore')}
                </span>
                <span
                  className={cn(
                    'font-medium tabular-nums',
                    app.feedback.recommendationScore > 0 &&
                      'text-emerald-600 dark:text-emerald-400',
                    app.feedback.recommendationScore < 0 && 'text-destructive',
                  )}
                >
                  {app.feedback.recommendationScore > 0 && '+'}
                  {app.feedback.recommendationScore}
                </span>
              </div>
              <p className="text-muted-foreground text-xs">
                {t('recruitment.applications.feedbackCount', {
                  submitted: app.feedback.submitted,
                  total: app.feedback.total,
                })}
              </p>
            </CardContent>
          </Card>
          <ActivityCard app={app} />
        </div>
      </div>

      <InterviewFormDialog open={scheduling} onOpenChange={setScheduling} applicationId={id} />
      <OfferDialog open={offering} onOpenChange={setOffering} application={app} />
      <HireDialog open={hiring} onOpenChange={setHiring} application={app} />
      <ReasonDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={t('recruitment.applications.rejectTitle', { name: app.candidateName })}
        label={t('recruitment.applications.rejectReason')}
        confirmLabel={t('recruitment.applications.reject')}
        pending={reject.isPending}
        onSubmit={(reason) =>
          reject.mutate(
            { id, data: { reason } },
            {
              onSuccess: async () => {
                setRejecting(false);
                await done(t('recruitment.applications.rejected'));
              },
            },
          )
        }
      />
    </>
  );
}

function CandidateCard({ app }: { app: JobApplicationDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t('recruitment.candidate')}</CardTitle>
        <div className="flex gap-2">
          {app.hasCv && <CvButton load={() => candidatesCvUrl(app.candidateId)} />}
          <Button variant="outline" size="sm" asChild>
            <Link to="/recruitment/candidates/$id" params={{ id: app.candidateId }}>
              {t('recruitment.applications.candidateProfile')}
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label={t('common.email')}>
            <a href={`mailto:${app.candidateEmail}`} className="text-primary hover:underline">
              {app.candidateEmail}
            </a>
          </Field>
          <Field label={t('common.phone')}>{app.candidatePhone}</Field>
          <Field label={t('common.city')}>{app.candidateCity}</Field>
          <Field label={t('recruitment.candidates.source')}>
            {t(`recruitment.sources.${app.source}`)}
          </Field>
          <Field label={t('recruitment.candidates.expectedSalary')}>
            {app.expectedSalary && (
              <span className="tabular-nums">
                {formatMoney(app.expectedSalary, app.currencyCode)}
              </span>
            )}
          </Field>
          <Field label={t('recruitment.applications.appliedAt')}>{formatDate(app.appliedAt)}</Field>
          <Field label={t('employees.department')}>{app.departmentName}</Field>
          <Field label={t('employees.position')}>{app.positionName}</Field>
          <Field label={t('recruitment.postings.hiringManager')}>{app.hiringManagerName}</Field>
        </dl>
      </CardContent>
    </Card>
  );
}

function InterviewsCard({ app }: { app: JobApplicationDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const cancel = useInterviewsCancel();
  const [editing, setEditing] = useState<InterviewDto | null>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recruitment.interviews.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {app.interviews.length ? (
          <ul className="space-y-3">
            {app.interviews.map((interview) => (
              <li key={interview.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-medium">
                      {t(`recruitment.interviewTypes.${interview.type}`)}
                      <InterviewStatusBadge status={interview.status} />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateTime(interview.scheduledAt)} ·{' '}
                      {t('recruitment.interviews.minutes', { count: interview.durationMinutes })}
                      {interview.location && ` · ${interview.location}`}
                    </div>
                  </div>
                  {interview.status === 'SCHEDULED' && app.canEdit && (
                    <Can permission="recruitment:update">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(interview)}>
                          <Pencil /> {t('common.edit')}
                        </Button>
                        <ConfirmDialog
                          trigger={
                            <Button variant="ghost" size="sm" className="text-destructive">
                              <X /> {t('recruitment.interviews.cancel')}
                            </Button>
                          }
                          title={t('recruitment.interviews.cancelTitle')}
                          description={t('recruitment.interviews.cancelDescription')}
                          confirmLabel={t('recruitment.interviews.cancel')}
                          onConfirm={() =>
                            cancel.mutate(
                              { id: interview.id },
                              {
                                onSuccess: async () => {
                                  toast.success(t('recruitment.interviews.cancelled'));
                                  await invalidate();
                                },
                              },
                            )
                          }
                        />
                      </div>
                    </Can>
                  )}
                </div>
                {interview.notes && (
                  <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                    {interview.notes}
                  </p>
                )}
                <ul className="mt-3 space-y-2">
                  {interview.participants.map((p) => (
                    <li key={p.id} className="bg-muted/40 rounded-md p-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-medium">{p.employeeName}</span>
                          {p.positionName && (
                            <span className="text-muted-foreground text-xs">
                              {' '}
                              · {p.positionName}
                            </span>
                          )}
                        </span>
                        {p.submittedAt ? (
                          <span className="inline-flex items-center gap-2">
                            <Rating value={p.rating} />
                            {p.recommendation && <RecommendationBadge value={p.recommendation} />}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">
                            {interview.status === 'CANCELLED'
                              ? '—'
                              : t('recruitment.interviews.awaitingFeedback')}
                          </span>
                        )}
                      </div>
                      {p.feedback && (
                        <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                          “{p.feedback}”
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t('recruitment.interviews.none')}</p>
        )}
      </CardContent>
      <InterviewFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        applicationId={app.id}
        interview={editing ?? undefined}
      />
    </Card>
  );
}

function OffersCard({ app }: { app: JobApplicationDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const accept = useJobOffersAccept();
  const decline = useJobOffersDecline();
  const withdraw = useJobOffersWithdraw();
  const busy = accept.isPending || decline.isPending || withdraw.isPending;
  const respond = (action: typeof accept, offerId: string, message: string) =>
    action.mutate(
      { id: offerId },
      {
        onSuccess: async () => {
          toast.success(message);
          await invalidate();
        },
      },
    );
  const editable = app.stage !== 'HIRED' && app.postingStatus !== 'CLOSED';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recruitment.offers.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {app.offers.length ? (
          <ul className="space-y-3">
            {app.offers.map((offer) => (
              <li key={offer.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold tabular-nums">
                        {formatMoney(offer.grossSalary, offer.currencyCode)}
                      </span>
                      <OfferStatusBadge status={offer.status} />
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t('recruitment.offers.summary', {
                        start: formatDate(offer.startDate),
                        expires: formatDate(offer.expiresAt),
                      })}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {offer.createdByName} · {formatDate(offer.createdAt)}
                      {offer.respondedAt &&
                        ` · ${t('recruitment.offers.respondedAt', {
                          date: formatDate(offer.respondedAt),
                        })}`}
                    </div>
                  </div>
                  {editable && (
                    <Can permission="recruitment:create">
                      <div className="flex flex-wrap gap-1">
                        {offer.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                respond(accept, offer.id, t('recruitment.offers.accepted'))
                              }
                            >
                              {accept.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                              {t('recruitment.offers.accept')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                respond(decline, offer.id, t('recruitment.offers.declined'))
                              }
                            >
                              <X /> {t('recruitment.offers.decline')}
                            </Button>
                          </>
                        )}
                        {(offer.status === 'PENDING' || offer.status === 'ACCEPTED') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            disabled={busy}
                            onClick={() =>
                              respond(withdraw, offer.id, t('recruitment.offers.withdrawn'))
                            }
                          >
                            <Undo2 /> {t('recruitment.offers.withdraw')}
                          </Button>
                        )}
                      </div>
                    </Can>
                  )}
                </div>
                {offer.notes && (
                  <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                    {offer.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">{t('recruitment.offers.none')}</p>
        )}
      </CardContent>
    </Card>
  );
}

function activityText(t: TFunction, a: ApplicationActivityDto) {
  switch (a.type) {
    case 'STAGE':
      return a.fromStage
        ? t('recruitment.activity.stage', {
            from: t(`recruitment.stages.${a.fromStage}`),
            to: t(`recruitment.stages.${a.toStage!}`),
          })
        : t('recruitment.activity.applied');
    case 'INTERVIEW':
      return t(`recruitment.activity.interview.${a.body as InterviewStatus}`);
    case 'OFFER':
      return t(`recruitment.activity.offer.${a.body as JobOfferStatus}`);
    case 'HIRED':
      return t('recruitment.activity.hired', { employeeNo: a.body ?? '' });
    default:
      return a.body ?? '';
  }
}

function ActivityCard({ app }: { app: JobApplicationDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const addNote = useJobApplicationsAddNote();
  const [note, setNote] = useState('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('recruitment.activity.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={note}
            placeholder={t('recruitment.activity.notePlaceholder')}
            aria-label={t('recruitment.activity.note')}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            disabled={!note.trim() || addNote.isPending}
            onClick={() =>
              addNote.mutate(
                { id: app.id, data: { body: note.trim() } },
                {
                  onSuccess: async () => {
                    setNote('');
                    await invalidate();
                  },
                },
              )
            }
          >
            {addNote.isPending && <Loader2 className="animate-spin" />}
            {t('recruitment.activity.addNote')}
          </Button>
        </div>
        <ol className="relative space-y-3 border-l pl-4">
          {app.activities.map((a) => (
            <li key={a.id} className="text-sm">
              <span
                className={cn(
                  'absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white dark:border-neutral-950',
                  a.type === 'NOTE'
                    ? 'bg-amber-400'
                    : a.type === 'HIRED'
                      ? 'bg-emerald-500'
                      : 'bg-primary',
                )}
              />
              <div className={a.type === 'NOTE' ? 'whitespace-pre-line' : 'font-medium'}>
                {activityText(t, a)}
              </div>
              {a.type === 'STAGE' && a.body && (
                <div className="text-muted-foreground text-xs">{a.body}</div>
              )}
              <div className="text-muted-foreground text-xs">
                {a.createdByName} · {formatDateTime(a.createdAt)}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
