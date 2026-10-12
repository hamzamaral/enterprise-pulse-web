import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getSalesQuotesFindAllQueryKey,
  getSalesQuotesFindOneQueryKey,
  useSalesQuotesFindOne,
  useSalesQuotesReject,
} from '@/api/generated/endpoints/sales/sales';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { storedBreakdown } from '@/features/trade/document-math';
import { DocumentLinesTable } from '@/features/trade/document-lines-table';
import { DocumentHeader } from '@/features/trade/document-print';
import { DocumentTotals } from '@/features/trade/document-totals';
import { Field } from '@/shared/components/info-card';
import { formatDate } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { RecordNotFound } from '@/shared/components/route-error';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { ConvertQuoteDialog } from './convert-quote-dialog';
import { SalesQuoteStatusBadge } from './sales-components';

export function SalesQuoteDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const can = usePermission();
  const invalidate = useInvalidate();
  const [converting, setConverting] = useState(false);
  const { data: quote, isLoading } = useSalesQuotesFindOne(id);
  const reject = useSalesQuotesReject();

  if (!quote) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const onReject = () =>
    reject.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('sales.quotes.rejected'));
          await invalidate(getSalesQuotesFindOneQueryKey(id), getSalesQuotesFindAllQueryKey());
        },
      },
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/sales/quotes"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('sales.quotes.title')}
        </Link>
        <div className="flex gap-2">
          {quote.status === 'OPEN' && (
            <>
              <Can permission="sales:update">
                <Button variant="outline" disabled={reject.isPending} onClick={onReject}>
                  <X /> {t('sales.quotes.reject')}
                </Button>
              </Can>
              {!quote.expired && (
                <Can permission="sales:create">
                  <Button onClick={() => setConverting(true)}>
                    <Check /> {t('sales.quotes.convert')}
                  </Button>
                </Can>
              )}
            </>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {t('trade.print')}
          </Button>
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 pt-6">
          <DocumentHeader
            title={t('sales.quotes.document')}
            number={quote.number}
            status={<SalesQuoteStatusBadge status={quote.status} expired={quote.expired} />}
            partner={{
              code: quote.partnerCode,
              title: quote.partnerTitle,
              label: t('sales.customer'),
            }}
          >
            <Field label={t('trade.date')}>{formatDate(quote.quoteDate)}</Field>
            <Field label={t('sales.quotes.validUntil')}>
              <span className={quote.expired && quote.status === 'OPEN' ? 'text-destructive' : ''}>
                {formatDate(quote.validUntil)}
              </span>
            </Field>
            <Field label={t('trade.currency')}>
              {quote.currencyCode}
              {quote.currencyCode !== base && ` · ${Number(quote.exchangeRate)}`}
            </Field>
            <Field label={t('sales.orders.createdBy')}>{quote.createdByName}</Field>
            {quote.opportunityId && (
              <Field label={t('sales.quotes.opportunity')}>
                {can('crm:read') ? (
                  <Link
                    to="/crm/opportunities/$id"
                    params={{ id: quote.opportunityId }}
                    className="text-primary hover:underline print:no-underline"
                  >
                    {quote.opportunityNumber} · {quote.opportunityTitle}
                  </Link>
                ) : (
                  `${quote.opportunityNumber} · ${quote.opportunityTitle}`
                )}
              </Field>
            )}
            {quote.orderId && (
              <Field label={t('sales.orders.single')}>
                <Link
                  to="/sales/orders/$id"
                  params={{ id: quote.orderId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {quote.orderNumber}
                </Link>
              </Field>
            )}
            {quote.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label={t('common.notes')}>{quote.notes}</Field>
              </div>
            )}
          </DocumentHeader>
          <DocumentLinesTable lines={quote.lines} currency={quote.currencyCode} />
          <DocumentTotals
            totals={{ ...quote, vatBreakdown: storedBreakdown(quote.lines) }}
            currency={quote.currencyCode}
            baseTotal={quote.grandTotalBase}
            baseCurrency={base}
          />
          {quote.status === 'OPEN' && quote.validUntil && (
            <p className="text-muted-foreground hidden text-sm print:block">
              {t('sales.quotes.validityNote', { date: formatDate(quote.validUntil) })}
            </p>
          )}
        </CardContent>
      </Card>

      {converting && (
        <ConvertQuoteDialog quote={quote} open={converting} onOpenChange={setConverting} />
      )}
    </>
  );
}
