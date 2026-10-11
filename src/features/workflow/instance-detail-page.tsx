import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, CircleDot, Loader2, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getWorkflowInstancesFindOneQueryKey,
  getWorkflowInstancesInboxQueryKey,
  useWorkflowInstancesApprove,
  useWorkflowInstancesCancel,
  useWorkflowInstancesFindOne,
  useWorkflowInstancesReject,
} from '@/api/generated/endpoints/workflow/workflow';
import type { WorkflowInstanceDetailDto } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import { WorkflowStatusBadge } from './workflow-components';

function StepTimeline({ instance }: { instance: WorkflowInstanceDetailDto }) {
  return (
    <ol className="space-y-4">
      {instance.steps.map((step) => {
        const done =
          step.order < instance.currentStepOrder ||
          (instance.status === 'APPROVED' && step.order <= instance.currentStepOrder);
        const rejected = instance.status === 'REJECTED' && step.order === instance.currentStepOrder;
        const current = instance.status === 'PENDING' && step.order === instance.currentStepOrder;
        return (
          <li key={step.id} className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-full border text-sm',
                done && 'border-emerald-500 bg-emerald-500 text-white',
                rejected && 'border-red-500 bg-red-500 text-white',
                current && 'border-primary text-primary ring-primary/20 ring-4',
              )}
            >
              {done ? (
                <Check className="size-4" />
              ) : rejected ? (
                <X className="size-4" />
              ) : current ? (
                <CircleDot className="size-4" />
              ) : (
                step.order
              )}
            </span>
            <span className={cn('text-sm', current && 'font-medium')}>{step.name}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function InstanceDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const { data: instance, isLoading } = useWorkflowInstancesFindOne(id);
  const [comment, setComment] = useState('');
  const invalidate = useInvalidate();
  const approve = useWorkflowInstancesApprove();
  const reject = useWorkflowInstancesReject();
  const cancel = useWorkflowInstancesCancel();

  const onDone = async () => {
    setComment('');
    toast.success(t('common.saved'));
    await invalidate(getWorkflowInstancesFindOneQueryKey(id), getWorkflowInstancesInboxQueryKey());
  };

  if (isLoading || !instance) {
    return <Skeleton className="h-96 w-full" />;
  }

  const pending = approve.isPending || reject.isPending || cancel.isPending;
  const canCancel =
    instance.status === 'PENDING' &&
    (instance.startedById === me?.user.id || me?.user.isSuperAdmin);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link to="/workflow/inbox">
          <ArrowLeft /> {t('common.back')}
        </Link>
      </Button>
      <PageHeader
        title={instance.title}
        description={`${instance.definitionName} · ${instance.entityType} ${instance.entityId}`}
        actions={<WorkflowStatusBadge status={instance.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('common.details')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <div className="text-muted-foreground">{t('workflow.requester')}</div>
                <div className="font-medium">{instance.startedByName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('workflow.startedAt')}</div>
                <div className="font-medium">{formatDateTime(instance.startedAt)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('workflow.currentStep')}</div>
                <div className="font-medium">
                  {instance.status === 'PENDING' ? instance.currentStepName : '—'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">{t('workflow.completedAt')}</div>
                <div className="font-medium">{formatDateTime(instance.completedAt)}</div>
              </div>
            </CardContent>
          </Card>

          {(instance.canAct || canCancel) && (
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Textarea
                  placeholder={t('common.comment')}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <div className="flex flex-wrap gap-2">
                  {instance.canAct && (
                    <>
                      <Button
                        disabled={pending}
                        onClick={() =>
                          approve.mutate(
                            { id, data: { comment: comment || undefined } },
                            { onSuccess: onDone },
                          )
                        }
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                        {t('workflow.approve')}
                      </Button>
                      <Button
                        variant="destructive"
                        disabled={pending || comment.trim().length < 2}
                        title={t('workflow.rejectReason')}
                        onClick={() =>
                          reject.mutate({ id, data: { comment } }, { onSuccess: onDone })
                        }
                      >
                        <X /> {t('workflow.reject')}
                      </Button>
                    </>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        cancel.mutate(
                          { id, data: { comment: comment || undefined } },
                          { onSuccess: onDone },
                        )
                      }
                    >
                      {t('workflow.cancelRequest')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('workflow.history')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l pl-6">
                {instance.actions.map((action) => (
                  <li key={action.id} className="relative">
                    <span className="bg-primary absolute top-1.5 -left-[29px] size-2.5 rounded-full" />
                    <div className="text-sm">
                      <span className="font-medium">{action.userName}</span>{' '}
                      <span className="text-muted-foreground">
                        {t(`workflow.actionTypes.${action.type}`)}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateTime(action.createdAt)}
                    </div>
                    {action.comment && (
                      <p className="bg-muted/50 mt-1.5 rounded-md px-3 py-2 text-sm">
                        {action.comment}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{t('workflow.steps')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StepTimeline instance={instance} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
