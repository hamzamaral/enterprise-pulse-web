import { Link } from '@tanstack/react-router';
import { ArrowLeft, Check, Printer, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getSupplierQuotesFindAllQueryKey,
  getSupplierQuotesFindOneQueryKey,
  useSupplierQuotesFindOne,
  useSupplierQuotesReject,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { Can } from '@/features/auth/can';
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
import { AcceptQuoteDialog } from './accept-quote-dialog';
import { QuoteStatusBadge, useBaseCurrency } from './purchasing-components';

export function QuoteDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const [accepting, setAccepting] = useState(false);
  const { data: quote, isLoading } = useSupplierQuotesFindOne(id);
  const reject = useSupplierQuotesReject();

  if (isLoading || !quote) {
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
          toast.success(t('purchasing.quotes.rejected'));
          await invalidate(
            getSupplierQuotesFindOneQueryKey(id),
            getSupplierQuotesFindAllQueryKey(),
          );
        },
      },
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/purchasing/quotes"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('purchasing.quotes.title')}
        </Link>
        <div className="flex gap-2">
          {quote.status === 'OPEN' && (
            <>
              <Can permission="purchasing:update">
                <Button variant="outline" disabled={reject.isPending} onClick={onReject}>
                  <X /> {t('purchasing.quotes.reject')}
                </Button>
              </Can>
              <Can permission="purchasing:create">
                <Button onClick={() => setAccepting(true)}>
                  <Check /> {t('purchasing.quotes.accept')}
                </Button>
              </Can>
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
            title={t('purchasing.quotes.document')}
            number={quote.number}
            status={<QuoteStatusBadge status={quote.status} />}
            partner={{
              code: quote.partnerCode,
              title: quote.partnerTitle,
              label: t('purchasing.supplier'),
            }}
          >
            <Field label={t('trade.date')}>{formatDate(quote.quoteDate)}</Field>
            <Field label={t('purchasing.quotes.validUntil')}>{formatDate(quote.validUntil)}</Field>
            <Field label={t('purchasing.quotes.deliveryDays')}>
              {quote.deliveryDays === null
                ? null
                : t('partners.days', { count: quote.deliveryDays })}
            </Field>
            <Field label={t('trade.currency')}>
              {quote.currencyCode}
              {quote.currencyCode !== base && ` · ${Number(quote.exchangeRate)}`}
            </Field>
            {quote.requestId && (
              <Field label={t('purchasing.requests.single')}>
                <Link
                  to="/purchasing/requests/$id"
                  params={{ id: quote.requestId }}
                  className="text-primary font-mono text-xs hover:underline"
                >
                  {quote.requestNumber}
                </Link>
              </Field>
            )}
            {quote.orderId && (
              <Field label={t('purchasing.orders.single')}>
                <Link
                  to="/purchasing/orders/$id"
                  params={{ id: quote.orderId }}
                  className="text-primary font-mono text-xs hover:underline"
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
        </CardContent>
      </Card>

      {accepting && (
        <AcceptQuoteDialog
          quote={quote}
          requestId={quote.requestId}
          open={accepting}
          onOpenChange={setAccepting}
        />
      )}
    </>
  );
}
