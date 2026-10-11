import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, Check, FilePlus2, Trophy, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getPurchaseRequestsComparisonQueryKey,
  getPurchaseRequestsFindAllQueryKey,
  getPurchaseRequestsFindOneQueryKey,
  getSupplierQuotesFindAllQueryKey,
  usePurchaseRequestsCancel,
  usePurchaseRequestsComparison,
  usePurchaseRequestsFindOne,
  useSupplierQuotesReject,
} from '@/api/generated/endpoints/purchasing/purchasing';
import type {
  ComparisonQuoteDto,
  PurchaseOrderStatus,
  PurchaseRequestDetailDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { useMe, usePermission } from '@/features/auth/use-session';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { AcceptQuoteDialog } from './accept-quote-dialog';
import { OrderStatusBadge, QuoteStatusBadge, RequestStatusBadge } from './purchasing-components';
import { CancelDocumentDialog } from '@/features/trade/trade-components';

export function RequestDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const [cancelling, setCancelling] = useState(false);
  const { data: request, isLoading } = usePurchaseRequestsFindOne(id);
  const cancel = usePurchaseRequestsCancel();

  if (isLoading || !request) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const open = request.status === 'PENDING' || request.status === 'APPROVED';
  const canCancel = open && (request.requestedById === me?.user.id || can('purchasing:update'));
  const estimated = Number(request.estimatedTotal);

  const onCancel = (reason?: string) =>
    cancel.mutate(
      { id, data: { reason } },
      {
        onSuccess: async () => {
          toast.success(t('purchasing.requests.cancelled'));
          setCancelling(false);
          await invalidate(
            getPurchaseRequestsFindOneQueryKey(id),
            getPurchaseRequestsFindAllQueryKey(),
          );
        },
      },
    );

  return (
    <>
      <Link
        to="/purchasing/requests"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('purchasing.requests.title')}
      </Link>
      <PageHeader
        title={request.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{request.number}</code>
            <RequestStatusBadge status={request.status} />
          </span>
        }
        actions={
          <>
            {request.status === 'APPROVED' && (
              <Can permission="purchasing:create">
                <Button asChild>
                  <Link to="/purchasing/quotes/new" search={{ requestId: request.id }}>
                    <FilePlus2 /> {t('purchasing.quotes.new')}
                  </Link>
                </Button>
              </Can>
            )}
            {canCancel && (
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban /> {t('purchasing.requests.cancel')}
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {t('trade.lines')} ({request.lines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>{t('trade.item')}</TableHead>
                    <TableHead className="text-right">{t('trade.quantity')}</TableHead>
                    <TableHead className="text-right">{t('trade.estimatedPrice')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {request.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-muted-foreground">{line.lineNo}</TableCell>
                      <TableCell>
                        {line.sku && (
                          <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>
                        )}
                        {line.description}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(line.quantity, line.unitCode ?? undefined)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {line.estimatedPrice ? formatMoney(line.estimatedPrice) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {estimated > 0 && (
              <div className="mt-3 flex justify-end gap-3 text-sm">
                <span className="text-muted-foreground">
                  {t('purchasing.requests.estimatedTotal')}
                </span>
                <span className="font-semibold tabular-nums">{formatMoney(estimated)}</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t('purchasing.requests.date')}>{formatDate(request.requestDate)}</Field>
              <Field label={t('purchasing.requests.neededBy')}>
                {formatDate(request.neededBy)}
              </Field>
              <Field label={t('purchasing.requests.requestedBy')}>{request.requestedByName}</Field>
              <Field label={t('purchasing.requests.department')}>{request.departmentName}</Field>
              {request.workflowInstanceId && can('workflow:read') && (
                <Field label={t('purchasing.requests.approval')}>
                  <Link
                    to="/workflow/instances/$id"
                    params={{ id: request.workflowInstanceId }}
                    className="text-primary hover:underline"
                  >
                    {t('purchasing.requests.viewApproval')}
                  </Link>
                </Field>
              )}
              {request.decidedAt && (
                <Field label={t('purchasing.requests.decidedAt')}>
                  {formatDate(request.decidedAt)}
                </Field>
              )}
              {request.notes && (
                <div className="col-span-2">
                  <Field label={t('purchasing.requests.reason')}>{request.notes}</Field>
                </div>
              )}
              {request.orders.length > 0 && (
                <div className="col-span-2">
                  <Field label={t('purchasing.orders.title')}>
                    <span className="flex flex-col gap-1">
                      {request.orders.map((order) => (
                        <Link
                          key={order.id}
                          to="/purchasing/orders/$id"
                          params={{ id: order.id }}
                          className="text-primary inline-flex items-center gap-2 hover:underline"
                        >
                          <code className="text-xs">{order.number}</code>
                          <OrderStatusBadge status={order.status as PurchaseOrderStatus} />
                        </Link>
                      ))}
                    </span>
                  </Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {can('purchasing:read') && request.quoteCount > 0 && <QuoteComparison request={request} />}

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('purchasing.requests.cancelTitle', { number: request.number })}
        pending={cancel.isPending}
        onConfirm={onCancel}
      />
    </>
  );
}

function QuoteComparison({ request }: { request: PurchaseRequestDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const { data } = usePurchaseRequestsComparison(request.id);
  const reject = useSupplierQuotesReject();
  const [accepting, setAccepting] = useState<ComparisonQuoteDto | null>(null);
  if (!data) return <Skeleton className="mt-4 h-48" />;

  const base = data.baseCurrency;
  const bestByLine = new Map(
    data.lines.map((line) => {
      const prices = data.quotes
        .filter((q) => q.status !== 'REJECTED')
        .flatMap((q) => q.prices.filter((p) => p.requestLineId === line.id))
        .map((p) => Number(p.netUnitPriceBase));
      return [line.id, prices.length ? Math.min(...prices) : null];
    }),
  );
  const canAccept = request.status === 'APPROVED';

  const onReject = (quoteId: string) =>
    reject.mutate(
      { id: quoteId },
      {
        onSuccess: async () => {
          toast.success(t('purchasing.quotes.rejected'));
          await invalidate(
            getPurchaseRequestsComparisonQueryKey(request.id),
            getSupplierQuotesFindAllQueryKey(),
          );
        },
      },
    );

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-base">{t('purchasing.comparison.title')}</CardTitle>
        <p className="text-muted-foreground text-sm">
          {t('purchasing.comparison.hint', { currency: base })}
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">{t('trade.item')}</TableHead>
                {data.quotes.map((quote) => (
                  <TableHead key={quote.id} className="min-w-44 text-right align-top">
                    <div className="space-y-1 py-2">
                      <div className="text-foreground flex items-center justify-end gap-1 font-medium">
                        {quote.id === data.bestQuoteId && (
                          <Trophy className="size-3.5 text-amber-500" />
                        )}
                        {quote.partnerTitle}
                      </div>
                      <Link
                        to="/purchasing/quotes/$id"
                        params={{ id: quote.id }}
                        className="text-primary block font-mono text-xs hover:underline"
                      >
                        {quote.number}
                      </Link>
                      <div className="flex justify-end">
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    {line.description}
                    <span className="text-muted-foreground block text-xs">
                      {formatQuantity(line.quantity, line.unitCode ?? undefined)}
                    </span>
                  </TableCell>
                  {data.quotes.map((quote) => {
                    const price = quote.prices.find((p) => p.requestLineId === line.id);
                    if (!price) {
                      return (
                        <TableCell key={quote.id} className="text-muted-foreground text-right">
                          —
                        </TableCell>
                      );
                    }
                    const best =
                      quote.status !== 'REJECTED' &&
                      Number(price.netUnitPriceBase) === bestByLine.get(line.id);
                    return (
                      <TableCell
                        key={quote.id}
                        className={cn(
                          'text-right tabular-nums',
                          best &&
                            'bg-emerald-500/10 font-medium text-emerald-700 dark:text-emerald-400',
                        )}
                      >
                        {formatMoney(price.unitPrice, quote.currencyCode)}
                        {quote.currencyCode !== base ? (
                          <span className="text-muted-foreground block text-xs">
                            ≈ {formatMoney(price.netUnitPriceBase, base)}
                          </span>
                        ) : (
                          Number(price.netUnitPriceBase) !== Number(price.unitPrice) && (
                            <span className="text-muted-foreground block text-xs">
                              {t('purchasing.comparison.net', {
                                amount: formatMoney(price.netUnitPriceBase, base),
                              })}
                            </span>
                          )
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow className="hover:bg-transparent">
                <TableCell className="font-medium">{t('trade.grandTotal')}</TableCell>
                {data.quotes.map((quote) => (
                  <TableCell key={quote.id} className="text-right font-semibold tabular-nums">
                    {formatMoney(quote.grandTotal, quote.currencyCode)}
                    {quote.currencyCode !== base && (
                      <span className="text-muted-foreground block text-xs font-normal">
                        ≈ {formatMoney(quote.grandTotalBase, base)}
                      </span>
                    )}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableCell className="text-muted-foreground">
                  {t('purchasing.quotes.deliveryDays')}
                </TableCell>
                {data.quotes.map((quote) => (
                  <TableCell key={quote.id} className="text-right">
                    {quote.deliveryDays === null
                      ? '—'
                      : t('partners.days', { count: quote.deliveryDays })}
                  </TableCell>
                ))}
              </TableRow>
              {canAccept && (
                <TableRow className="hover:bg-transparent">
                  <TableCell />
                  {data.quotes.map((quote) => (
                    <TableCell key={quote.id} className="text-right">
                      {quote.status === 'OPEN' && (
                        <div className="flex justify-end gap-1">
                          <Can permission="purchasing:update">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={reject.isPending}
                              onClick={() => onReject(quote.id)}
                            >
                              <X /> {t('purchasing.quotes.reject')}
                            </Button>
                          </Can>
                          <Can permission="purchasing:create">
                            <Button size="sm" onClick={() => setAccepting(quote)}>
                              <Check /> {t('purchasing.quotes.accept')}
                            </Button>
                          </Can>
                        </div>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      {accepting && (
        <AcceptQuoteDialog
          quote={accepting}
          requestId={request.id}
          open={!!accepting}
          onOpenChange={(open) => !open && setAccepting(null)}
        />
      )}
    </Card>
  );
}
