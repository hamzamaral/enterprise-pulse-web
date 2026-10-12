import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, FilePlus2, Pencil, RotateCcw, Trash2, Trophy, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getCrmSummaryQueryKey,
  getOpportunitiesBoardQueryKey,
  getOpportunitiesFindAllQueryKey,
  useOpportunitiesFindOne,
  useOpportunitiesRemove,
} from '@/api/generated/endpoints/crm/crm';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { SalesQuoteStatusBadge } from '@/features/sales/sales-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ActivityTimeline } from './activity-timeline';
import {
  isOpenStage,
  OPEN_STAGES,
  ProbabilityBar,
  ReasonDialog,
  StageBadge,
} from './crm-components';
import { OpportunityFormDialog } from './opportunity-form-dialog';
import { useOpportunityActions } from './use-opportunity-actions';

export function OpportunityDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);
  const [losing, setLosing] = useState(false);
  const { data: opportunity, isLoading } = useOpportunitiesFindOne(id);
  const actions = useOpportunityActions();
  const remove = useOpportunitiesRemove();

  if (!opportunity) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const open = isOpenStage(opportunity.stage);
  const currentIndex = OPEN_STAGES.indexOf(opportunity.stage);
  const editable = open && can('crm:update');

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('crm.opportunities.deleted'));
          await invalidate(
            getOpportunitiesFindAllQueryKey(),
            getOpportunitiesBoardQueryKey(),
            getCrmSummaryQueryKey(),
          );
          await navigate({ to: '/crm/opportunities' });
        },
      },
    );

  return (
    <>
      <Link
        to="/crm/opportunities"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('crm.opportunities.title')}
      </Link>
      <PageHeader
        title={opportunity.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{opportunity.number}</code>
            <StageBadge stage={opportunity.stage} />
            {opportunity.overdue && (
              <span className="text-destructive text-xs">{t('crm.opportunities.overdue')}</span>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {open ? (
              <>
                <Can permission="sales:create">
                  <Button variant="outline" asChild>
                    <Link
                      to="/sales/quotes/new"
                      search={{ partnerId: opportunity.partnerId, opportunityId: opportunity.id }}
                    >
                      <FilePlus2 /> {t('crm.opportunities.createQuote')}
                    </Link>
                  </Button>
                </Can>
                <Can permission="crm:update">
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> {t('common.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive"
                    onClick={() => setLosing(true)}
                  >
                    <XCircle /> {t('crm.opportunities.lose')}
                  </Button>
                  <Button disabled={actions.pending} onClick={() => actions.win(opportunity)}>
                    <Trophy /> {t('crm.opportunities.win')}
                  </Button>
                </Can>
              </>
            ) : (
              <Can permission="crm:update">
                <Button
                  variant="outline"
                  disabled={actions.pending}
                  onClick={() => actions.reopen(opportunity)}
                >
                  <RotateCcw /> {t('crm.opportunities.reopen')}
                </Button>
              </Can>
            )}
            {opportunity.quotes.length === 0 && (
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

      <ol className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {OPEN_STAGES.map((stage, index) => {
          const reached = open ? index <= currentIndex : opportunity.stage === 'WON';
          const current = stage === opportunity.stage;
          return (
            <li key={stage}>
              <button
                type="button"
                disabled={!editable || current || actions.pending}
                onClick={() => actions.move(opportunity, stage)}
                className={cn(
                  'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
                  reached
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'text-muted-foreground',
                  current && 'border-primary font-semibold',
                  editable && !current && 'hover:border-primary/60 cursor-pointer',
                )}
              >
                <span className="text-xs opacity-70">{index + 1}.</span>{' '}
                {t(`crm.opportunities.stages.${stage}`)}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('sales.customer')}>
                <Link
                  to="/partners/$id"
                  params={{ id: opportunity.partnerId }}
                  className="text-primary hover:underline"
                >
                  {opportunity.partnerTitle}
                </Link>
              </Field>
              <Field label={t('crm.amount')}>
                <span className="font-medium tabular-nums">
                  {formatMoney(opportunity.amount, opportunity.currencyCode)}
                </span>
              </Field>
              <Field label={t('crm.opportunities.probability')}>
                <ProbabilityBar value={opportunity.probability} />
              </Field>
              <Field label={t('crm.opportunities.weighted')}>
                <span className="tabular-nums">
                  {formatMoney(opportunity.weightedAmount, opportunity.currencyCode)}
                </span>
              </Field>
              <Field label={t('crm.opportunities.expectedClose')}>
                <span className={cn(opportunity.overdue && 'text-destructive font-medium')}>
                  {formatDate(opportunity.expectedCloseDate)}
                </span>
              </Field>
              <Field label={t('crm.owner')}>{opportunity.ownerName}</Field>
              {opportunity.leadId && (
                <Field label={t('crm.opportunities.lead')}>
                  <Link
                    to="/crm/leads/$id"
                    params={{ id: opportunity.leadId }}
                    className="text-primary font-mono text-xs hover:underline"
                  >
                    {opportunity.leadNumber}
                  </Link>
                </Field>
              )}
              <Field label={t('sales.orders.createdBy')}>{opportunity.createdByName}</Field>
              <Field label={t('common.createdAt')}>{formatDate(opportunity.createdAt)}</Field>
              {opportunity.closedAt && (
                <Field label={t('crm.opportunities.closedAt')}>
                  {formatDateTime(opportunity.closedAt)}
                </Field>
              )}
              {opportunity.lostReason && (
                <div className="sm:col-span-3">
                  <Field label={t('crm.opportunities.lostReason')}>{opportunity.lostReason}</Field>
                </div>
              )}
              {opportunity.description && (
                <div className="sm:col-span-3">
                  <Field label={t('common.description')}>
                    <span className="whitespace-pre-line">{opportunity.description}</span>
                  </Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('crm.opportunities.quotes')}</CardTitle>
          </CardHeader>
          <CardContent>
            {opportunity.quotes.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trade.number')}</TableHead>
                    <TableHead className="text-right">{t('trade.grandTotal')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opportunity.quotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell>
                        {can('sales:read') ? (
                          <Link
                            to="/sales/quotes/$id"
                            params={{ id: quote.id }}
                            className="text-primary font-mono text-xs hover:underline"
                          >
                            {quote.number}
                          </Link>
                        ) : (
                          <code className="text-xs">{quote.number}</code>
                        )}
                        <div className="text-muted-foreground text-xs">
                          {formatDate(quote.quoteDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(quote.grandTotal, quote.currencyCode)}
                      </TableCell>
                      <TableCell>
                        <SalesQuoteStatusBadge status={quote.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-sm">{t('crm.opportunities.noQuotes')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <ActivityTimeline link={{ opportunityId: opportunity.id }} />
      </div>

      {open && (
        <OpportunityFormDialog open={editing} onOpenChange={setEditing} opportunity={opportunity} />
      )}
      <ReasonDialog
        open={losing}
        onOpenChange={setLosing}
        title={t('crm.opportunities.loseTitle', { number: opportunity.number })}
        label={t('crm.opportunities.lostReason')}
        confirmLabel={t('crm.opportunities.lose')}
        pending={actions.pending}
        onSubmit={(reason) => actions.lose(opportunity, reason, () => setLosing(false))}
      />
    </>
  );
}
