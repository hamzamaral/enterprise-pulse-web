import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  usePerformanceGoalsRemove,
  usePerformanceGoalsUpdate,
  usePerformanceReviewsAcknowledge,
  usePerformanceReviewsAddGoal,
  usePerformanceReviewsFindOne,
  usePerformanceReviewsReopen,
  usePerformanceReviewsReturnToEmployee,
  usePerformanceReviewsSaveManager,
  usePerformanceReviewsSaveSelf,
} from '@/api/generated/endpoints/performance/performance';
import type {
  PerformanceReviewDetailDto,
  ReviewCompetencyDto,
  ReviewGoalDto,
} from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { Rating } from '@/features/recruitment/recruitment-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';
import {
  CycleStatusBadge,
  formatScore,
  ProgressBar,
  ReviewStatusBadge,
  ScoreBadge,
  useInvalidatePerformance,
} from './performance-components';

type Rated = number | null;

/** Unsaved edits on top of the loaded review; cleared after every save. */
interface Draft {
  goalRatings: Record<string, Rated>;
  progress: Record<string, number>;
  competencyRatings: Record<string, Rated>;
  competencyComments: Record<string, string>;
  selfComment?: string;
  managerComment?: string;
  strengths?: string;
  improvements?: string;
}

const EMPTY_DRAFT: Draft = {
  goalRatings: {},
  progress: {},
  competencyRatings: {},
  competencyComments: {},
};

const goalSchema = z.object({
  title: v.requiredString(),
  description: z.string(),
  weight: z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(1).max(100),
  progress: z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(0).max(100),
});

export function ReviewPage({ id }: { id: string }) {
  const { data: review, isLoading } = usePerformanceReviewsFindOne(id);
  if (!review) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  return <ReviewView review={review} />;
}

function ReviewView({ review }: { review: PerformanceReviewDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePerformance();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [goalEditor, setGoalEditor] = useState<{ open: boolean; goal: ReviewGoalDto | null }>({
    open: false,
    goal: null,
  });
  const saveSelf = usePerformanceReviewsSaveSelf();
  const saveManager = usePerformanceReviewsSaveManager();
  const returnBack = usePerformanceReviewsReturnToEmployee();
  const acknowledge = usePerformanceReviewsAcknowledge();
  const reopen = usePerformanceReviewsReopen();
  const addGoal = usePerformanceReviewsAddGoal();
  const updateGoal = usePerformanceGoalsUpdate();
  const removeGoal = usePerformanceGoalsRemove();

  const selfMode = review.canSelfReview;
  const managerMode = review.canManagerReview;
  const usesGoals = review.goalWeight > 0;
  const usesCompetencies = review.goalWeight < 100;

  const selfRating = (g: ReviewGoalDto) =>
    g.id in draft.goalRatings && selfMode ? draft.goalRatings[g.id] : g.selfRating;
  const managerRating = (g: ReviewGoalDto) =>
    g.id in draft.goalRatings && managerMode ? draft.goalRatings[g.id] : g.managerRating;
  const progress = (g: ReviewGoalDto) => draft.progress[g.id] ?? g.progress;
  const compSelf = (c: ReviewCompetencyDto) =>
    c.id in draft.competencyRatings && selfMode ? draft.competencyRatings[c.id] : c.selfRating;
  const compManager = (c: ReviewCompetencyDto) =>
    c.id in draft.competencyRatings && managerMode
      ? draft.competencyRatings[c.id]
      : c.managerRating;
  const compComment = (c: ReviewCompetencyDto) => draft.competencyComments[c.id] ?? c.comment ?? '';

  const totalWeight = review.goals.reduce((sum, g) => sum + g.weight, 0);
  const weightOk = !usesGoals || (review.goals.length > 0 && totalWeight === 100);
  const ownRating = selfMode ? selfRating : managerRating;
  const ownComp = selfMode ? compSelf : compManager;
  const missing =
    (usesGoals ? review.goals.filter((g) => ownRating(g) === null).length : 0) +
    (usesCompetencies ? review.competencies.filter((c) => ownComp(c) === null).length : 0);
  const ready = weightOk && missing === 0;
  const dirty =
    Object.keys(draft.goalRatings).length > 0 ||
    Object.keys(draft.progress).length > 0 ||
    Object.keys(draft.competencyRatings).length > 0 ||
    Object.keys(draft.competencyComments).length > 0 ||
    draft.selfComment !== undefined ||
    draft.managerComment !== undefined ||
    draft.strengths !== undefined ||
    draft.improvements !== undefined;

  const done = async (message: string) => {
    toast.success(message);
    setDraft(EMPTY_DRAFT);
    await invalidate();
  };

  const submitSelf = (submit: boolean) =>
    saveSelf.mutate(
      {
        id: review.id,
        data: {
          selfComment: emptyToNull(draft.selfComment ?? review.selfComment ?? ''),
          goals: review.goals.map((g) => ({
            id: g.id,
            rating: selfRating(g),
            progress: progress(g),
          })),
          competencies: review.competencies.map((c) => ({ id: c.id, rating: compSelf(c) })),
          submit,
        },
      },
      {
        onSuccess: () =>
          done(submit ? t('performance.reviews.selfSubmitted') : t('performance.reviews.saved')),
      },
    );

  const submitManager = (submit: boolean) =>
    saveManager.mutate(
      {
        id: review.id,
        data: {
          managerComment: emptyToNull(draft.managerComment ?? review.managerComment ?? ''),
          strengths: emptyToNull(draft.strengths ?? review.strengths ?? ''),
          improvements: emptyToNull(draft.improvements ?? review.improvements ?? ''),
          goals: review.goals.map((g) => ({ id: g.id, rating: managerRating(g) })),
          competencies: review.competencies.map((c) => ({
            id: c.id,
            rating: compManager(c),
            comment: emptyToNull(compComment(c)),
          })),
          submit,
        },
      },
      {
        onSuccess: () =>
          done(submit ? t('performance.reviews.completed') : t('performance.reviews.saved')),
      },
    );

  const setGoalRating = (goalId: string, value: Rated) =>
    setDraft((d) => ({ ...d, goalRatings: { ...d.goalRatings, [goalId]: value } }));
  const setCompRating = (ratingId: string, value: Rated) =>
    setDraft((d) => ({ ...d, competencyRatings: { ...d.competencyRatings, [ratingId]: value } }));

  const saving = saveSelf.isPending || saveManager.isPending;
  const backTo = review.viewer === 'HR' ? 'cycle' : 'my';

  return (
    <>
      {backTo === 'cycle' ? (
        <Link
          to="/performance/cycles/$id"
          params={{ id: review.cycleId }}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {review.cycleName}
        </Link>
      ) : (
        <Link
          to="/performance/my"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('performance.my.title')}
        </Link>
      )}
      <PageHeader
        title={review.viewer === 'EMPLOYEE' ? review.cycleName : review.employeeName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {review.viewer === 'EMPLOYEE'
              ? `${formatDate(review.periodStart)} – ${formatDate(review.periodEnd)}`
              : review.cycleName}
            <ReviewStatusBadge status={review.status} />
            {review.cycleStatus !== 'ACTIVE' && <CycleStatusBadge status={review.cycleStatus} />}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {review.canReturn && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={returnBack.isPending}>
                    <Undo2 /> {t('performance.reviews.return')}
                  </Button>
                }
                title={t('performance.reviews.returnTitle')}
                description={t('performance.reviews.returnDescription')}
                confirmLabel={t('performance.reviews.return')}
                onConfirm={() =>
                  returnBack.mutate(
                    { id: review.id },
                    { onSuccess: () => done(t('performance.reviews.returned')) },
                  )
                }
              />
            )}
            {review.canReopen && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={reopen.isPending}>
                    <RotateCcw /> {t('performance.reviews.reopen')}
                  </Button>
                }
                title={t('performance.reviews.reopenTitle')}
                description={t('performance.reviews.reopenDescription')}
                confirmLabel={t('performance.reviews.reopen')}
                onConfirm={() =>
                  reopen.mutate(
                    { id: review.id },
                    { onSuccess: () => done(t('performance.reviews.reopened')) },
                  )
                }
              />
            )}
            {review.canAcknowledge && (
              <Button
                disabled={acknowledge.isPending}
                onClick={() =>
                  acknowledge.mutate(
                    { id: review.id },
                    { onSuccess: () => done(t('performance.reviews.acknowledgedToast')) },
                  )
                }
              >
                <CheckCircle2 /> {t('performance.reviews.acknowledge')}
              </Button>
            )}
          </div>
        }
      />

      <Steps review={review} />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('employees.employee')}>
                {review.employeeName}
                <code className="text-muted-foreground ml-1 text-xs">{review.employeeNo}</code>
              </Field>
              <Field label={t('employees.department')}>{review.departmentName}</Field>
              <Field label={t('employees.position')}>{review.positionName}</Field>
              <Field label={t('performance.reviews.reviewer')}>{review.reviewerName}</Field>
              <Field label={t('performance.cycles.selfReviewDue')}>
                {formatDate(review.selfReviewDue)}
              </Field>
              <Field label={t('performance.cycles.managerReviewDue')}>
                {formatDate(review.managerReviewDue)}
              </Field>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('performance.reviews.result')}</CardTitle>
            <CardDescription>
              {t('performance.cycles.weightSplit', {
                goals: review.goalWeight,
                competencies: 100 - review.goalWeight,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {review.overallScore === null ? (
              <p className="text-muted-foreground">{t('performance.reviews.noResult')}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {t('performance.reviews.overallScore')}
                  </span>
                  <ScoreBadge score={review.overallScore} />
                </div>
                {usesGoals && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t('performance.reviews.goalScore')}
                    </span>
                    <span className="tabular-nums">{formatScore(review.goalScore)}</span>
                  </div>
                )}
                {usesCompetencies && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">
                      {t('performance.reviews.competencyScore')}
                    </span>
                    <span className="tabular-nums">{formatScore(review.competencyScore)}</span>
                  </div>
                )}
                {review.acknowledgedAt && (
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-muted-foreground inline-flex items-center gap-1">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      {t('performance.reviews.acknowledged')}
                    </span>
                    <span>{formatDateTime(review.acknowledgedAt)}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {usesGoals && (
        <Card className="mb-4">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-base">
                {t('performance.reviews.goals')}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  %{review.goalWeight}
                </span>
              </CardTitle>
              {review.canEditGoals && (
                <CardDescription
                  className={cn(review.goals.length > 0 && !weightOk && 'text-destructive')}
                >
                  {t('performance.reviews.weightTotal', { total: totalWeight })}
                </CardDescription>
              )}
            </div>
            {review.canEditGoals && review.goals.length < 10 && (
              <Button size="sm" onClick={() => setGoalEditor({ open: true, goal: null })}>
                <Plus /> {t('performance.reviews.addGoal')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {review.goals.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                {review.canEditGoals
                  ? t('performance.reviews.noGoalsEditable')
                  : t('performance.reviews.noGoals')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('performance.reviews.goal')}</TableHead>
                    <TableHead className="w-20 text-right">
                      {t('performance.reviews.weight')}
                    </TableHead>
                    <TableHead className="w-40">{t('performance.reviews.progress')}</TableHead>
                    <TableHead className="w-32">{t('performance.reviews.selfRating')}</TableHead>
                    <TableHead className="w-32">{t('performance.reviews.managerRating')}</TableHead>
                    {review.canEditGoals && <TableHead className="w-20" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {review.goals.map((goal) => (
                    <TableRow key={goal.id}>
                      <TableCell className="whitespace-normal">
                        <div className="font-medium">{goal.title}</div>
                        {goal.description && (
                          <div className="text-muted-foreground text-xs">{goal.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">%{goal.weight}</TableCell>
                      <TableCell>
                        {selfMode ? (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            className="h-8 w-20"
                            aria-label={t('performance.reviews.progress')}
                            value={progress(goal)}
                            onChange={(e) => {
                              const value = Math.min(100, Math.max(0, Number(e.target.value)));
                              setDraft((d) => ({
                                ...d,
                                progress: { ...d.progress, [goal.id]: value },
                              }));
                            }}
                          />
                        ) : (
                          <span className="flex items-center gap-2">
                            <ProgressBar value={progress(goal)} className="w-16" />
                            <span className="text-muted-foreground text-xs tabular-nums">
                              %{progress(goal)}
                            </span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Rating
                          value={selfRating(goal)}
                          size={selfMode ? 'md' : 'sm'}
                          label={goal.title}
                          onChange={selfMode ? (n) => setGoalRating(goal.id, n) : undefined}
                        />
                      </TableCell>
                      <TableCell>
                        <Rating
                          value={managerRating(goal)}
                          size={managerMode ? 'md' : 'sm'}
                          label={goal.title}
                          onChange={managerMode ? (n) => setGoalRating(goal.id, n) : undefined}
                        />
                      </TableCell>
                      {review.canEditGoals && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t('common.edit')}
                              onClick={() => setGoalEditor({ open: true, goal })}
                            >
                              <Pencil />
                            </Button>
                            <ConfirmDialog
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive size-8"
                                  aria-label={t('common.delete')}
                                >
                                  <Trash2 />
                                </Button>
                              }
                              onConfirm={() =>
                                removeGoal.mutate(
                                  { id: goal.id },
                                  { onSuccess: () => done(t('performance.reviews.goalDeleted')) },
                                )
                              }
                            />
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {usesCompetencies && review.competencies.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">
              {t('performance.cycles.competencies')}
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                %{100 - review.goalWeight}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('performance.reviews.competency')}</TableHead>
                  <TableHead className="w-32">{t('performance.reviews.selfRating')}</TableHead>
                  <TableHead className="w-32">{t('performance.reviews.managerRating')}</TableHead>
                  <TableHead className="w-72">{t('performance.reviews.managerNote')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {review.competencies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{c.name}</div>
                      {c.description && (
                        <div className="text-muted-foreground text-xs">{c.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Rating
                        value={compSelf(c)}
                        size={selfMode ? 'md' : 'sm'}
                        label={c.name}
                        onChange={selfMode ? (n) => setCompRating(c.id, n) : undefined}
                      />
                    </TableCell>
                    <TableCell>
                      <Rating
                        value={compManager(c)}
                        size={managerMode ? 'md' : 'sm'}
                        label={c.name}
                        onChange={managerMode ? (n) => setCompRating(c.id, n) : undefined}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {managerMode ? (
                        <Input
                          className="h-8"
                          maxLength={1000}
                          aria-label={`${c.name}: ${t('performance.reviews.managerNote')}`}
                          value={compComment(c)}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              competencyComments: {
                                ...d.competencyComments,
                                [c.id]: e.target.value,
                              },
                            }))
                          }
                        />
                      ) : (
                        <span className="text-muted-foreground text-sm">{c.comment ?? '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <CommentCard
          title={t('performance.reviews.selfComment')}
          editable={selfMode}
          value={draft.selfComment ?? review.selfComment ?? ''}
          placeholder={t('performance.reviews.selfCommentPlaceholder')}
          onChange={(value) => setDraft((d) => ({ ...d, selfComment: value }))}
        />
        <CommentCard
          title={t('performance.reviews.managerComment')}
          editable={managerMode}
          value={draft.managerComment ?? review.managerComment ?? ''}
          onChange={(value) => setDraft((d) => ({ ...d, managerComment: value }))}
        />
        <CommentCard
          title={t('performance.reviews.strengths')}
          editable={managerMode}
          value={draft.strengths ?? review.strengths ?? ''}
          onChange={(value) => setDraft((d) => ({ ...d, strengths: value }))}
        />
        <CommentCard
          title={t('performance.reviews.improvements')}
          editable={managerMode}
          value={draft.improvements ?? review.improvements ?? ''}
          onChange={(value) => setDraft((d) => ({ ...d, improvements: value }))}
        />
      </div>

      {(selfMode || managerMode) && (
        <Card className="sticky bottom-4 z-10 shadow-lg">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <p
              className={cn(
                'flex-1 text-sm',
                ready ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400',
              )}
            >
              {!weightOk
                ? t('performance.reviews.weightHint')
                : missing
                  ? t('performance.reviews.missing', { count: missing })
                  : selfMode
                    ? t('performance.reviews.readySelf')
                    : t('performance.reviews.readyManager')}
            </p>
            <Button
              variant="outline"
              disabled={saving || !dirty}
              onClick={() => (selfMode ? submitSelf(false) : submitManager(false))}
            >
              <Save /> {t('performance.reviews.saveDraft')}
            </Button>
            <ConfirmDialog
              trigger={
                <Button disabled={saving || !ready}>
                  {saving ? <Loader2 className="animate-spin" /> : <Send />}
                  {selfMode ? t('performance.reviews.submitSelf') : t('performance.reviews.submit')}
                </Button>
              }
              title={
                selfMode
                  ? t('performance.reviews.submitSelfTitle')
                  : t('performance.reviews.submitTitle')
              }
              description={
                selfMode
                  ? t('performance.reviews.submitSelfDescription')
                  : t('performance.reviews.submitDescription')
              }
              confirmLabel={
                selfMode ? t('performance.reviews.submitSelf') : t('performance.reviews.submit')
              }
              onConfirm={() => (selfMode ? submitSelf(true) : submitManager(true))}
            />
          </CardContent>
        </Card>
      )}

      <SimpleFormDialog<z.infer<typeof goalSchema>>
        open={goalEditor.open}
        onOpenChange={(open) => setGoalEditor((s) => ({ ...s, open }))}
        title={goalEditor.goal ? goalEditor.goal.title : t('performance.reviews.addGoal')}
        schema={goalSchema}
        pending={addGoal.isPending || updateGoal.isPending}
        defaultValues={{
          title: goalEditor.goal?.title ?? '',
          description: goalEditor.goal?.description ?? '',
          weight: goalEditor.goal?.weight ?? Math.max(1, 100 - totalWeight),
          progress: goalEditor.goal?.progress ?? 0,
        }}
        fields={[
          { name: 'title', label: t('performance.reviews.goal'), wide: true },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
          { name: 'weight', label: t('performance.reviews.weight'), type: 'number' },
          { name: 'progress', label: t('performance.reviews.progress'), type: 'number' },
        ]}
        onSubmit={({ description, ...rest }) => {
          const data = { ...rest, description: emptyToNull(description) };
          const onSuccess = async () => {
            toast.success(t('common.saved'));
            setGoalEditor((s) => ({ ...s, open: false }));
            await invalidate();
          };
          if (goalEditor.goal) updateGoal.mutate({ id: goalEditor.goal.id, data }, { onSuccess });
          else addGoal.mutate({ id: review.id, data }, { onSuccess });
        }}
      />
    </>
  );
}

/** Self review → manager review → completed, with the date each step was reached. */
function Steps({ review }: { review: PerformanceReviewDetailDto }) {
  const { t } = useTranslation();
  const steps = [
    {
      key: 'SELF_REVIEW',
      at: review.selfSubmittedAt,
      label: t('performance.reviewStatus.SELF_REVIEW'),
    },
    {
      key: 'MANAGER_REVIEW',
      at: review.managerSubmittedAt,
      label: t('performance.reviewStatus.MANAGER_REVIEW'),
    },
    { key: 'COMPLETED', at: review.acknowledgedAt, label: t('performance.reviews.acknowledged') },
  ] as const;
  const current = steps.findIndex((s) => s.key === review.status);
  return (
    <ol className="mb-4 grid gap-2 sm:grid-cols-3">
      {steps.map((step, index) => {
        const finished = !!step.at;
        const active = !finished && index === current;
        return (
          <li
            key={step.key}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
              active && 'border-primary bg-primary/5',
              finished && 'border-emerald-600/30',
            )}
          >
            {finished ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle
                className={cn('size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')}
              />
            )}
            <span className="flex-1">{step.label}</span>
            <span className="text-muted-foreground text-xs">{step.at && formatDate(step.at)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CommentCard({
  title,
  editable,
  value,
  placeholder,
  onChange,
}: {
  title: string;
  editable: boolean;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  if (!editable && !value) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {editable ? (
          <Textarea
            rows={4}
            maxLength={4000}
            aria-label={title}
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <p className="text-sm whitespace-pre-line">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}
