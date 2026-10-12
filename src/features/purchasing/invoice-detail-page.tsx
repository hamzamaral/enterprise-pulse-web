import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, Printer, Wallet } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getPartnersFindAllQueryKey } from '@/api/generated/endpoints/partners/partners';
import {
  getPurchaseInvoicesFindAllQueryKey,
  getPurchaseInvoicesFindOneQueryKey,
  getPurchaseOrdersFindOneQueryKey,
  usePurchaseInvoicesCancel,
  usePurchaseInvoicesFindOne,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DocumentLinesTable } from '@/features/trade/document-lines-table';
import { storedBreakdown } from '@/features/trade/document-math';
import { DocumentHeader } from '@/features/trade/document-print';
import { DocumentTotals } from '@/features/trade/document-totals';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { RecordNotFound } from '@/shared/components/route-error';
import {
  CancelDocumentDialog,
  InvoiceStatusBadge,
  PaymentStatusBadge,
  useBaseCurrency,
} from '@/features/trade/trade-components';

export function InvoiceDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const [cancelling, setCancelling] = useState(false);
  const { data: invoice, isLoading } = usePurchaseInvoicesFindOne(id);
  const cancel = usePurchaseInvoicesCancel();

  if (!invoice) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const issued = invoice.status === 'ISSUED';
  const onCancel = (reason?: string) =>
    cancel.mutate(
      { id, data: { reason } },
      {
        onSuccess: async () => {
          toast.success(t('purchasing.invoices.cancelled'));
          setCancelling(false);
          await invalidate(
            getPurchaseInvoicesFindOneQueryKey(id),
            getPurchaseInvoicesFindAllQueryKey(),
            getPartnersFindAllQueryKey(),
            ...(invoice.orderId ? [getPurchaseOrdersFindOneQueryKey(invoice.orderId)] : []),
          );
        },
      },
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/purchasing/invoices"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('purchasing.invoices.title')}
        </Link>
        <div className="flex gap-2">
          {issued && invoice.paymentStatus !== 'PAID' && (
            <Can permission="finance:create">
              <Button asChild>
                <Link
                  to="/finance/payments/new"
                  search={{ partnerId: invoice.partnerId, invoiceId: id }}
                >
                  <Wallet /> {t('finance.payments.payInvoice')}
                </Link>
              </Button>
            </Can>
          )}
          {issued && Number(invoice.paidAmount) === 0 && (
            <Can permission="purchasing:update">
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban /> {t('purchasing.invoices.cancel')}
              </Button>
            </Can>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {t('trade.print')}
          </Button>
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 pt-6">
          <DocumentHeader
            title={t('purchasing.invoices.document')}
            number={invoice.number}
            status={
              <span className="inline-flex gap-1">
                <InvoiceStatusBadge status={invoice.status} />
                {issued && (
                  <PaymentStatusBadge status={invoice.paymentStatus} overdue={invoice.overdue} />
                )}
              </span>
            }
            partner={{
              code: invoice.partnerCode,
              title: invoice.partnerTitle,
              label: t('purchasing.supplier'),
            }}
          >
            <Field label={t('purchasing.invoices.supplierInvoiceNo')}>
              <code className="text-xs">{invoice.supplierInvoiceNo}</code>
            </Field>
            <Field label={t('purchasing.invoices.date')}>{formatDate(invoice.invoiceDate)}</Field>
            <Field label={t('purchasing.invoices.dueDate')}>
              <span className={invoice.overdue ? 'text-destructive font-medium' : ''}>
                {formatDate(invoice.dueDate)}
              </span>
            </Field>
            <Field label={t('trade.currency')}>
              {invoice.currencyCode}
              {invoice.currencyCode !== base && ` · ${Number(invoice.exchangeRate)}`}
            </Field>
            {invoice.orderId && (
              <Field label={t('purchasing.orders.single')}>
                {can('purchasing:read') ? (
                  <Link
                    to="/purchasing/orders/$id"
                    params={{ id: invoice.orderId }}
                    className="text-primary font-mono text-xs hover:underline print:no-underline"
                  >
                    {invoice.orderNumber}
                  </Link>
                ) : (
                  <code className="text-xs">{invoice.orderNumber}</code>
                )}
              </Field>
            )}
            <Field label={t('trade.paidAmount')}>
              {formatMoney(invoice.paidAmount, invoice.currencyCode)}
            </Field>
            <Field label={t('purchasing.orders.createdBy')}>
              {invoice.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(invoice.createdAt)}
              </span>
            </Field>
            {invoice.cancelledAt && (
              <Field label={t('purchasing.invoices.cancelledAt')}>
                {formatDateTime(invoice.cancelledAt)}
              </Field>
            )}
            {invoice.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label={t('common.notes')}>
                  <span className="whitespace-pre-line">{invoice.notes}</span>
                </Field>
              </div>
            )}
          </DocumentHeader>
          <DocumentLinesTable lines={invoice.lines} currency={invoice.currencyCode} />
          <DocumentTotals
            totals={{ ...invoice, vatBreakdown: storedBreakdown(invoice.lines) }}
            currency={invoice.currencyCode}
            baseTotal={invoice.grandTotalBase}
            baseCurrency={base}
          />
        </CardContent>
      </Card>

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('purchasing.invoices.cancelTitle', { number: invoice.number })}
        description={t('purchasing.invoices.cancelHint')}
        pending={cancel.isPending}
        onConfirm={onCancel}
      />
    </>
  );
}
