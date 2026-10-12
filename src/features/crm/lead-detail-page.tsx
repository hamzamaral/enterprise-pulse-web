import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Ban, Pencil, RotateCcw, Trash2, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getCrmSummaryQueryKey,
  getLeadsFindAllQueryKey,
  getLeadsFindOneQueryKey,
  useLeadsDisqualify,
  useLeadsFindOne,
  useLeadsRemove,
  useLeadsReopen,
} from '@/api/generated/endpoints/crm/crm';
import { Can } from '@/features/auth/can';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { ActivityTimeline } from './activity-timeline';
import { ConvertLeadDialog } from './convert-lead-dialog';
import { LeadStatusBadge, ReasonDialog, StageBadge } from './crm-components';
import { LeadFormDialog } from './lead-form-dialog';

const WORKING = ['NEW', 'CONTACTED', 'QUALIFIED'];

export function LeadDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [disqualifying, setDisqualifying] = useState(false);
  const { data: lead, isLoading } = useLeadsFindOne(id);
  const disqualify = useLeadsDisqualify();
  const reopen = useLeadsReopen();
  const remove = useLeadsRemove();

  if (!lead) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const working = WORKING.includes(lead.status);
  const refresh = () =>
    invalidate(getLeadsFindOneQueryKey(id), getLeadsFindAllQueryKey(), getCrmSummaryQueryKey());

  const onDisqualify = (reason: string) =>
    disqualify.mutate(
      { id, data: { reason } },
      {
        onSuccess: async () => {
          toast.success(t('crm.leads.disqualified'));
          setDisqualifying(false);
          await refresh();
        },
      },
    );

  const onReopen = () =>
    reopen.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('crm.leads.reopened'));
          await refresh();
        },
      },
    );

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('crm.leads.deleted'));
          await invalidate(getLeadsFindAllQueryKey(), getCrmSummaryQueryKey());
          await navigate({ to: '/crm/leads' });
        },
      },
    );

  return (
    <>
      <Link
        to="/crm/leads"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('crm.leads.title')}
      </Link>
      <PageHeader
        title={lead.companyName}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{lead.number}</code>
            <LeadStatusBadge status={lead.status} />
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {working && (
              <Can permission="crm:update">
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil /> {t('common.edit')}
                </Button>
                <Button variant="outline" onClick={() => setDisqualifying(true)}>
                  <Ban /> {t('crm.leads.disqualify')}
                </Button>
                <Button onClick={() => setConverting(true)}>
                  <UserCheck /> {t('crm.leads.convert')}
                </Button>
              </Can>
            )}
            {lead.status === 'DISQUALIFIED' && (
              <Can permission="crm:update">
                <Button variant="outline" disabled={reopen.isPending} onClick={onReopen}>
                  <RotateCcw /> {t('crm.leads.reopen')}
                </Button>
              </Can>
            )}
            {lead.status !== 'CONVERTED' && (
              <Can permission="crm:delete">
                <ConfirmDialog
                  trigger={
                    <Button variant="outline" className="text-destructive">
                      <Trash2 /> {t('common.delete')}
                    </Button>
                  }
                  onConfirm={onDelete}
                />
              </Can>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('crm.leads.contactName')}>{lead.contactName}</Field>
              <Field label={t('common.email')}>
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                    {lead.email}
                  </a>
                )}
              </Field>
              <Field label={t('common.phone')}>
                {lead.phone && (
                  <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                    {lead.phone}
                  </a>
                )}
              </Field>
              <Field label={t('common.city')}>{lead.city}</Field>
              <Field label={t('crm.leads.source')}>{t(`crm.leads.sources.${lead.source}`)}</Field>
              <Field label={t('crm.leads.estimatedValue')}>
                {lead.estimatedValue && formatMoney(lead.estimatedValue, lead.currencyCode)}
              </Field>
              <Field label={t('crm.owner')}>{lead.ownerName}</Field>
              <Field label={t('sales.orders.createdBy')}>{lead.createdByName}</Field>
              <Field label={t('common.createdAt')}>{formatDate(lead.createdAt)}</Field>
              {lead.disqualifyReason && (
                <div className="sm:col-span-3">
                  <Field label={t('crm.leads.disqualifyReason')}>{lead.disqualifyReason}</Field>
                </div>
              )}
              {lead.notes && (
                <div className="sm:col-span-3">
                  <Field label={t('common.notes')}>
                    <span className="whitespace-pre-line">{lead.notes}</span>
                  </Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.leads.conversion')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lead.partnerId ? (
              <dl className="grid gap-4">
                <Field label={t('crm.leads.customer')}>
                  <Link
                    to="/partners/$id"
                    params={{ id: lead.partnerId }}
                    className="text-primary hover:underline"
                  >
                    {lead.partnerTitle}
                  </Link>
                </Field>
                <Field label={t('crm.leads.convertedAt')}>{formatDate(lead.convertedAt)}</Field>
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">{t('crm.leads.notConverted')}</p>
            )}
            {lead.opportunities.length > 0 && (
              <div className="space-y-2">
                <div className="text-muted-foreground text-xs">{t('crm.leads.opportunities')}</div>
                {lead.opportunities.map((o) => (
                  <Link
                    key={o.id}
                    to="/crm/opportunities/$id"
                    params={{ id: o.id }}
                    className="hover:bg-muted/60 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{o.title}</div>
                      <div className="text-muted-foreground text-xs tabular-nums">
                        {formatMoney(o.amount, o.currencyCode)}
                      </div>
                    </div>
                    <StageBadge stage={o.stage} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <ActivityTimeline link={{ leadId: lead.id }} />
      </div>

      <LeadFormDialog open={editing} onOpenChange={setEditing} lead={lead} />
      {converting && (
        <ConvertLeadDialog lead={lead} open={converting} onOpenChange={setConverting} />
      )}
      <ReasonDialog
        open={disqualifying}
        onOpenChange={setDisqualifying}
        title={t('crm.leads.disqualifyTitle', { number: lead.number })}
        label={t('crm.leads.disqualifyReason')}
        confirmLabel={t('crm.leads.disqualify')}
        pending={disqualify.isPending}
        onSubmit={onDisqualify}
      />
    </>
  );
}
