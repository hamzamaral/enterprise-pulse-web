import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Briefcase, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  candidatesCvUrl,
  useCandidatesFindOne,
  useCandidatesRemove,
  useCandidatesRemoveCv,
  useCandidatesUploadCv,
} from '@/api/generated/endpoints/recruitment/recruitment';
import { Can } from '@/features/auth/can';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ApplyDialog } from './apply-dialog';
import { CandidateFormDialog } from './candidate-form-dialog';
import {
  ApplicationStageBadge,
  CvButton,
  isActiveStage,
  Rating,
  useInvalidateRecruitment,
} from './recruitment-components';

export function CandidatePage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateRecruitment();
  const fileInput = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [applying, setApplying] = useState(false);
  const { data: candidate, isLoading } = useCandidatesFindOne(id);
  const upload = useCandidatesUploadCv();
  const removeCv = useCandidatesRemoveCv();
  const remove = useCandidatesRemove();

  if (!candidate) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { id, data: { file } },
      {
        onSuccess: async () => {
          toast.success(t('recruitment.candidates.cvUploaded'));
          await invalidate();
        },
      },
    );
  };

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('recruitment.candidates.deleted'));
          await navigate({ to: '/recruitment/candidates' });
          await invalidate();
        },
      },
    );

  const subtitle = [candidate.currentTitle, candidate.currentCompany].filter(Boolean).join(' · ');

  return (
    <>
      <Link
        to="/recruitment/candidates"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('recruitment.candidates.title')}
      </Link>
      <PageHeader
        title={candidate.fullName}
        description={subtitle || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Can permission="recruitment:create">
              <Button variant="outline" onClick={() => setApplying(true)}>
                <Briefcase /> {t('recruitment.candidates.applyToPosting')}
              </Button>
            </Can>
            {candidate.canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {candidate.canDelete && (
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
              <Field label={t('common.email')}>
                <a href={`mailto:${candidate.email}`} className="text-primary hover:underline">
                  {candidate.email}
                </a>
              </Field>
              <Field label={t('common.phone')}>{candidate.phone}</Field>
              <Field label={t('common.city')}>{candidate.city}</Field>
              <Field label={t('recruitment.candidates.source')}>
                {t(`recruitment.sources.${candidate.source}`)}
              </Field>
              <Field label={t('recruitment.candidates.referredBy')}>
                {candidate.referredByName}
              </Field>
              <Field label={t('recruitment.candidates.expectedSalary')}>
                {candidate.expectedSalary && (
                  <span className="tabular-nums">
                    {formatMoney(candidate.expectedSalary, candidate.currencyCode)}
                  </span>
                )}
              </Field>
              <Field label={t('recruitment.candidates.linkedin')}>
                {candidate.linkedinUrl && (
                  <a
                    href={candidate.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary break-all hover:underline"
                  >
                    {candidate.linkedinUrl.replace(/^https?:\/\/(www\.)?/, '')}
                  </a>
                )}
              </Field>
              <Field label={t('recruitment.createdBy')}>{candidate.createdByName}</Field>
              <Field label={t('recruitment.candidates.addedAt')}>
                {formatDate(candidate.createdAt)}
              </Field>
              {candidate.notes && (
                <div className="sm:col-span-3">
                  <Field label={t('common.notes')}>
                    <span className="whitespace-pre-line">{candidate.notes}</span>
                  </Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('recruitment.candidates.cv')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {candidate.hasCv ? (
              <div className="flex items-center gap-1">
                <CvButton load={() => candidatesCvUrl(id)} name={candidate.cvFileName} />
                {candidate.canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('recruitment.candidates.removeCv')}
                    disabled={removeCv.isPending}
                    onClick={() => removeCv.mutate({ id }, { onSuccess: () => void invalidate() })}
                  >
                    <X />
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('recruitment.candidates.noCv')}</p>
            )}
            <Can permission="recruitment:create">
              <input
                ref={fileInput}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf"
                className="hidden"
                aria-label={t('recruitment.candidates.uploadCv')}
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInput.current?.click()}
              >
                {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
                {candidate.hasCv
                  ? t('recruitment.candidates.replaceCv')
                  : t('recruitment.candidates.uploadCv')}
              </Button>
            </Can>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('recruitment.candidates.applications')}</CardTitle>
        </CardHeader>
        <CardContent>
          {candidate.applications.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('recruitment.posting')}</TableHead>
                  <TableHead>{t('recruitment.applications.appliedAt')}</TableHead>
                  <TableHead>{t('recruitment.applications.rating')}</TableHead>
                  <TableHead>{t('recruitment.applications.stage')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {candidate.applications.map((app) => (
                  <TableRow key={app.id}>
                    <TableCell>
                      <Link
                        to="/recruitment/applications/$id"
                        params={{ id: app.id }}
                        className="text-primary font-medium hover:underline"
                      >
                        {app.postingTitle}
                      </Link>
                      <code className="text-muted-foreground block text-xs">
                        {app.postingNumber}
                      </code>
                    </TableCell>
                    <TableCell>{formatDate(app.appliedAt)}</TableCell>
                    <TableCell>
                      <Rating value={app.rating} />
                    </TableCell>
                    <TableCell>
                      <ApplicationStageBadge stage={app.stage} />
                      {isActiveStage(app.stage) && (
                        <div className="text-muted-foreground mt-0.5 text-xs">
                          {t('recruitment.applications.since', {
                            date: formatDate(app.stageChangedAt),
                          })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm">
              {t('recruitment.candidates.noApplications')}
            </p>
          )}
        </CardContent>
      </Card>

      {candidate.canEdit && (
        <CandidateFormDialog open={editing} onOpenChange={setEditing} candidate={candidate} />
      )}
      <ApplyDialog
        open={applying}
        onOpenChange={setApplying}
        candidateId={candidate.id}
        excludeIds={candidate.applications.map((a) => a.postingId)}
        onSaved={(saved) =>
          void navigate({ to: '/recruitment/applications/$id', params: { id: saved.id } })
        }
      />
    </>
  );
}
