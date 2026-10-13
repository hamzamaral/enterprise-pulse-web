import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Ban, ClipboardCheck, Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useTrainingEnrollmentsRemove,
  useTrainingSessionsCancel,
  useTrainingSessionsFindOne,
  useTrainingSessionsRemove,
} from '@/api/generated/endpoints/training/training';
import type { TrainingEnrollmentDto, TrainingSessionDetailDto } from '@/api/generated/model';
import { Rating } from '@/features/recruitment/recruitment-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  EnrollmentStatusBadge,
  formatDecimal,
  formatHours,
  formatSessionTime,
  SessionStatusBadge,
  useInvalidateTraining,
} from './training-components';
import { AddParticipantsDialog, CompleteSessionDialog } from './training-session-dialogs';
import { TrainingSessionFormDialog } from './training-session-form-dialog';

export function TrainingSessionPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateTraining();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [completing, setCompleting] = useState(false);
  const { data: session, isLoading } = useTrainingSessionsFindOne(id);
  const cancel = useTrainingSessionsCancel();
  const remove = useTrainingSessionsRemove();

  if (!session) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const onCancel = () =>
    cancel.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('training.sessions.cancelled'));
          await invalidate();
        },
      },
    );

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('training.sessions.deleted'));
          await navigate({ to: '/training' });
          await invalidate();
        },
      },
    );

  return (
    <>
      <Link
        to="/training"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('training.sessions.title')}
      </Link>
      <PageHeader
        title={session.courseTitle}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{session.courseCode}</code>
            {formatSessionTime(session.startsAt, session.endsAt)}
            <SessionStatusBadge status={session.status} />
            {session.isMandatory && (
              <Badge variant="outline">{t('training.courses.mandatory')}</Badge>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {session.canComplete && (
              <Button onClick={() => setCompleting(true)}>
                <ClipboardCheck /> {t('training.sessions.complete')}
              </Button>
            )}
            {session.canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {session.canCancel && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={cancel.isPending}>
                    <Ban /> {t('training.sessions.cancel')}
                  </Button>
                }
                title={t('training.sessions.cancelTitle')}
                description={t('training.sessions.cancelDescription')}
                confirmLabel={t('training.sessions.cancel')}
                onConfirm={onCancel}
              />
            )}
            {session.canDelete && (
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

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('training.category')}>
                {t(`training.categories.${session.category}`)}
              </Field>
              <Field label={t('training.format')}>{t(`training.formats.${session.format}`)}</Field>
              <Field label={t('training.courses.duration')}>
                {formatHours(session.durationHours)}
              </Field>
              <Field label={t('training.sessions.location')}>{session.location}</Field>
              <Field label={t('training.sessions.instructor')}>{session.instructor}</Field>
              <Field label={t('training.courses.provider')}>{session.provider}</Field>
              <Field label={t('training.sessions.capacity')}>
                {session.capacity === null
                  ? t('training.sessions.unlimited')
                  : `${session.enrolledCount} / ${session.capacity}`}
              </Field>
              <Field label={t('training.sessions.cost')}>
                {session.cost === null ? null : formatMoney(session.cost, session.currencyCode)}
              </Field>
              <Field label={t('training.courses.validity')}>
                {session.validityMonths
                  ? t('training.courses.validityValue', { count: session.validityMonths })
                  : t('training.courses.noExpiry')}
              </Field>
              <Field label={t('training.sessions.selfEnrollment')}>
                {session.selfEnrollment ? t('common.yes') : t('common.no')}
              </Field>
              <Field label={t('common.createdBy')}>{session.createdByName}</Field>
              {session.completedAt && (
                <Field label={t('training.sessions.completedAt')}>
                  {formatDateTime(session.completedAt)}
                </Field>
              )}
              {(session.notes || session.description) && (
                <div className="sm:col-span-3">
                  <dt className="text-muted-foreground mb-1 text-xs">{t('common.notes')}</dt>
                  <dd className="text-sm whitespace-pre-line">
                    {session.notes ?? session.description}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <FeedbackCard session={session} />
      </div>

      <EnrollmentsCard session={session} onAdd={() => setAdding(true)} />

      <TrainingSessionFormDialog open={editing} onOpenChange={setEditing} session={session} />
      <AddParticipantsDialog open={adding} onOpenChange={setAdding} session={session} />
      <CompleteSessionDialog open={completing} onOpenChange={setCompleting} session={session} />
    </>
  );
}

function FeedbackCard({ session }: { session: TrainingSessionDetailDto }) {
  const { t } = useTranslation();
  const comments = session.enrollments.filter((e) => e.feedbackComment);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('training.sessions.feedback')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {session.averageFeedback === null ? (
          <p className="text-muted-foreground">
            {session.status === 'COMPLETED'
              ? t('training.sessions.noFeedback')
              : t('training.sessions.feedbackAfter')}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {formatDecimal(session.averageFeedback, 1)}
              </span>
              <Rating value={Number(session.averageFeedback)} size="md" />
              <span className="text-muted-foreground text-xs">
                {t('training.sessions.feedbackCount', { count: session.feedbackCount })}
              </span>
            </div>
            <ul className="space-y-2">
              {comments.map((e) => (
                <li key={e.id} className="bg-muted/50 rounded-md p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{e.employeeName}</span>
                    <Rating value={e.feedbackRating} />
                  </div>
                  <p className="text-muted-foreground mt-1">{e.feedbackComment}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EnrollmentsCard({
  session,
  onAdd,
}: {
  session: TrainingSessionDetailDto;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const removeEnrollment = useTrainingEnrollmentsRemove();
  const completed = session.status === 'COMPLETED';

  const columns = useMemo<ColumnDef<TrainingEnrollmentDto, unknown>[]>(
    () => [
      {
        id: 'employee',
        header: t('employees.employee'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.employeeName}</span>
            <code className="text-muted-foreground block text-xs">{row.original.employeeNo}</code>
          </span>
        ),
      },
      {
        id: 'department',
        header: t('employees.department'),
        cell: ({ row }) => (
          <span>
            {row.original.departmentName ?? '—'}
            {row.original.positionName && (
              <span className="text-muted-foreground block text-xs">
                {row.original.positionName}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <EnrollmentStatusBadge status={row.original.status} />,
      },
      ...(completed
        ? ([
            {
              id: 'score',
              header: t('training.sessions.score'),
              cell: ({ row }) => <span className="tabular-nums">{row.original.score ?? '—'}</span>,
            },
            {
              id: 'certificate',
              header: t('training.sessions.certificateExpires'),
              cell: ({ row }) =>
                row.original.status === 'ATTENDED'
                  ? row.original.certificateExpiresAt
                    ? formatDate(row.original.certificateExpiresAt)
                    : t('training.courses.noExpiry')
                  : '—',
            },
            {
              id: 'feedback',
              header: t('training.sessions.feedback'),
              cell: ({ row }) =>
                row.original.feedbackRating === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <Rating value={row.original.feedbackRating} />
                ),
            },
          ] satisfies ColumnDef<TrainingEnrollmentDto, unknown>[])
        : [
            {
              id: 'enrolledAt',
              header: t('training.sessions.enrolledAt'),
              cell: ({ row }) => formatDate(row.original.enrolledAt),
            } satisfies ColumnDef<TrainingEnrollmentDto, unknown>,
          ]),
      ...(session.canEdit
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => (
                <div className="flex justify-end">
                  <ConfirmDialog
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive size-8"
                        aria-label={t('training.sessions.removeParticipant')}
                      >
                        <X />
                      </Button>
                    }
                    title={t('training.sessions.removeParticipant')}
                    description={t('training.sessions.removeDescription', {
                      name: row.original.employeeName,
                    })}
                    confirmLabel={t('common.remove')}
                    onConfirm={() =>
                      removeEnrollment.mutate(
                        { id: row.original.id },
                        {
                          onSuccess: async () => {
                            toast.success(t('training.sessions.participantRemoved'));
                            await invalidate();
                          },
                        },
                      )
                    }
                  />
                </div>
              ),
            } satisfies ColumnDef<TrainingEnrollmentDto, unknown>,
          ]
        : []),
    ],
    [t, completed, session.canEdit, removeEnrollment, invalidate],
  );

  const handleExport = async (format: ExportFormat) => {
    await exportTable(
      format,
      `training-${session.courseCode.toLowerCase()}`,
      [
        { header: t('employees.employeeNo'), value: (r) => r.employeeNo },
        { header: t('employees.employee'), value: (r) => r.employeeName },
        { header: t('employees.department'), value: (r) => r.departmentName },
        { header: t('employees.position'), value: (r) => r.positionName },
        { header: t('common.status'), value: (r) => t(`training.enrollmentStatus.${r.status}`) },
        { header: t('training.sessions.score'), value: (r) => r.score },
        {
          header: t('training.sessions.certificateExpires'),
          value: (r) => (r.certificateExpiresAt ? new Date(r.certificateExpiresAt) : null),
        },
        { header: t('training.sessions.feedback'), value: (r) => r.feedbackRating },
        { header: t('training.sessions.feedbackComment'), value: (r) => r.feedbackComment },
      ],
      session.enrollments,
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('training.sessions.participants')}
          <span className="text-muted-foreground ml-2 text-sm font-normal tabular-nums">
            {session.enrolledCount}
            {session.capacity !== null && ` / ${session.capacity}`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={session.enrollments}
          searchable={false}
          onExport={handleExport}
          toolbar={
            session.canEdit && (
              <Button size="sm" onClick={onAdd} disabled={session.seatsLeft === 0}>
                <UserPlus /> {t('training.sessions.addParticipants')}
              </Button>
            )
          }
        />
      </CardContent>
    </Card>
  );
}
