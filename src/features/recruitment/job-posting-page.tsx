import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  CirclePause,
  CirclePlay,
  Lock,
  Pencil,
  Send,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useJobPostingsBoard,
  useJobPostingsChangeStatus,
  useJobPostingsFindOne,
  useJobPostingsRemove,
} from '@/api/generated/endpoints/recruitment/recruitment';
import type { JobPostingStatus } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ApplicationBoard } from './application-board';
import { ApplyDialog } from './apply-dialog';
import { CandidateFormDialog } from './candidate-form-dialog';
import { JobPostingFormDialog } from './job-posting-form-dialog';
import {
  ApplicationStageBadge,
  CLOSED_STAGES,
  PostingStatusBadge,
  salaryRange,
  useInvalidateRecruitment,
} from './recruitment-components';

const STATUS_ACTIONS: Record<
  JobPostingStatus,
  {
    status: JobPostingStatus;
    label: 'publish' | 'hold' | 'close' | 'resume' | 'reopen';
    icon: typeof Send;
  }[]
> = {
  DRAFT: [{ status: 'OPEN', label: 'publish', icon: Send }],
  OPEN: [
    { status: 'ON_HOLD', label: 'hold', icon: CirclePause },
    { status: 'CLOSED', label: 'close', icon: Lock },
  ],
  ON_HOLD: [
    { status: 'OPEN', label: 'resume', icon: CirclePlay },
    { status: 'CLOSED', label: 'close', icon: Lock },
  ],
  CLOSED: [{ status: 'OPEN', label: 'reopen', icon: CirclePlay }],
};

export function JobPostingPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidateRecruitment();
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [adding, setAdding] = useState(false);
  const { data: posting, isLoading } = useJobPostingsFindOne(id);
  const { data: applications } = useJobPostingsBoard(id);
  const changeStatus = useJobPostingsChangeStatus();
  const remove = useJobPostingsRemove();

  if (!posting) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const closedApps = (applications ?? []).filter((a) => CLOSED_STAGES.includes(a.stage));
  const takesApplications = posting.status === 'OPEN';

  const setStatus = (status: JobPostingStatus) =>
    changeStatus.mutate(
      { id, data: { status } },
      {
        onSuccess: async () => {
          toast.success(t(`recruitment.postings.statusChanged.${status}`));
          await invalidate();
        },
      },
    );

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('recruitment.postings.deleted'));
          await navigate({ to: '/recruitment' });
          await invalidate();
        },
      },
    );

  return (
    <>
      <Link
        to="/recruitment"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('recruitment.postings.title')}
      </Link>
      <PageHeader
        title={posting.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{posting.number}</code>
            <PostingStatusBadge status={posting.status} />
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {posting.canEdit && (
              <>
                {STATUS_ACTIONS[posting.status].map((action) => (
                  <Button
                    key={action.status}
                    variant={action.status === 'OPEN' ? 'default' : 'outline'}
                    disabled={changeStatus.isPending}
                    onClick={() => setStatus(action.status)}
                  >
                    <action.icon /> {t(`recruitment.postings.${action.label}`)}
                  </Button>
                ))}
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> {t('common.edit')}
                </Button>
              </>
            )}
            {posting.canDelete && (
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
              <Field label={t('employees.department')}>{posting.departmentName}</Field>
              <Field label={t('employees.position')}>{posting.positionName}</Field>
              <Field label={t('employees.branch')}>{posting.branchName}</Field>
              <Field label={t('employees.employmentType')}>
                {t(`employees.employmentTypes.${posting.employmentType}`)}
              </Field>
              <Field label={t('recruitment.postings.location')}>{posting.location}</Field>
              <Field label={t('recruitment.postings.hiringManager')}>
                {posting.hiringManagerName}
              </Field>
              <Field label={t('recruitment.postings.salary')}>
                <span className="tabular-nums">
                  {salaryRange(posting.salaryMin, posting.salaryMax, posting.currencyCode)}
                </span>
              </Field>
              <Field label={t('recruitment.postings.hired')}>
                <span className="tabular-nums">
                  {posting.hiredCount} / {posting.openings}
                </span>
              </Field>
              <Field label={t('recruitment.postings.closesAt')}>
                {formatDate(posting.closesAt)}
              </Field>
              <Field label={t('recruitment.postings.publishedAt')}>
                {formatDate(posting.publishedAt)}
              </Field>
              {posting.closedAt && (
                <Field label={t('recruitment.postings.closedAt')}>
                  {formatDate(posting.closedAt)}
                </Field>
              )}
              <Field label={t('recruitment.createdBy')}>{posting.createdByName}</Field>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('recruitment.postings.jobDescription')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="whitespace-pre-line">{posting.description ?? '—'}</p>
            {posting.requirements && (
              <div>
                <div className="text-muted-foreground mb-1 text-xs">
                  {t('recruitment.postings.requirementsTitle')}
                </div>
                <ul className="list-disc space-y-0.5 pl-5">
                  {posting.requirements
                    .split('\n')
                    .filter(Boolean)
                    .map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t('recruitment.postings.pipeline')}</h2>
        {takesApplications && (
          <Can permission="recruitment:create">
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setApplying(true)}>
                <Users /> {t('recruitment.applications.addExisting')}
              </Button>
              <Button onClick={() => setAdding(true)}>
                <UserPlus /> {t('recruitment.candidates.new')}
              </Button>
            </div>
          </Can>
        )}
      </div>
      {!takesApplications && posting.status !== 'CLOSED' && (
        <p className="text-muted-foreground mb-3 text-sm">
          {t(`recruitment.postings.notTaking.${posting.status as 'DRAFT' | 'ON_HOLD'}`)}
        </p>
      )}
      <ApplicationBoard
        applications={applications}
        editable={can('recruitment:create') && posting.status !== 'CLOSED'}
      />

      {closedApps.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">
              {t('recruitment.postings.closedApplications')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recruitment.candidate')}</TableHead>
                  <TableHead>{t('recruitment.applications.appliedAt')}</TableHead>
                  <TableHead>{t('recruitment.applications.closedAt')}</TableHead>
                  <TableHead>{t('recruitment.applications.stage')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closedApps.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link
                        to="/recruitment/applications/$id"
                        params={{ id: app.id }}
                        className="text-primary font-medium hover:underline"
                      >
                        {app.candidateName}
                      </Link>
                      {app.candidateTitle && (
                        <div className="text-muted-foreground text-xs">{app.candidateTitle}</div>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(app.appliedAt)}</TableCell>
                    <TableCell>{formatDate(app.stageChangedAt)}</TableCell>
                    <TableCell>
                      <ApplicationStageBadge stage={app.stage} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {posting.canEdit && (
        <JobPostingFormDialog
          open={editing}
          onOpenChange={setEditing}
          posting={posting}
          onSaved={() => void invalidate()}
        />
      )}
      <ApplyDialog
        open={applying}
        onOpenChange={setApplying}
        postingId={posting.id}
        excludeIds={(applications ?? []).map((a) => a.candidateId)}
      />
      <CandidateFormDialog open={adding} onOpenChange={setAdding} applyToPostingId={posting.id} />
    </>
  );
}
