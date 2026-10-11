import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, Printer, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getPartnersFindAllQueryKey } from '@/api/generated/endpoints/partners/partners';
import {
  getSalesInvoicesFindAllQueryKey,
  getSalesInvoicesFindOneQueryKey,
  getSalesOrdersFindOneQueryKey,
  useSalesInvoicesCancel,
  useSalesInvoicesFindOne,
} from '@/api/generated/endpoints/sales/sales';
import type { SalesInvoiceLineDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DocumentLinesTable } from '@/features/trade/document-lines-table';
import { storedBreakdown } from '@/features/trade/document-math';
import { DocumentHeader } from '@/features/trade/document-print';
import { DocumentTotals } from '@/features/trade/document-totals';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  CancelDocumentDialog,
  InvoiceStatusBadge,
  PaymentStatusBadge,
  useBaseCurrency,
} from '@/features/trade/trade-components';

/** Quantity of an invoice line that can still be returned. */
export const openToReturn = (line: SalesInvoiceLineDto) =>
  Math.max(0, Number(line.quantity) - Number(line.returnedQty));

export function SalesInvoiceDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const [cancelling, setCancelling] = useState(false);
  const { data: invoice, isLoading } = useSalesInvoicesFindOne(id);
  const cancel = useSalesInvoicesCancel();

  if (isLoading || !invoice) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const issued = invoice.status === 'ISSUED';
  const canReturn = issued && invoice.lines.some((line) => openToReturn(line) > 0);
  const canCancel = issued && Number(invoice.paidAmount) === 0 && !invoice.returns.length;
  const hasReturns = invoice.lines.some((line) => Number(line.returnedQty) > 0);
  const onCancel = (reason?: string) =>
    cancel.mutate(
      { id, data: { reason } },
      {
        onSuccess: async () => {
          toast.success(t('sales.invoices.cancelled'));
          setCancelling(false);
          await invalidate(
            getSalesInvoicesFindOneQueryKey(id),
            getSalesInvoicesFindAllQueryKey(),
            getPartnersFindAllQueryKey(),
            ...(invoice.orderId ? [getSalesOrdersFindOneQueryKey(invoice.orderId)] : []),
          );
        },
      },
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/sales/invoices"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('sales.invoices.title')}
        </Link>
        <div className="flex gap-2">
          {canReturn && (
            <Can permission="sales:deliver">
              <Button variant="outline" asChild>
                <Link to="/sales/returns/new" search={{ invoiceId: id }}>
                  <Undo2 /> {t('sales.returns.new')}
                </Link>
              </Button>
            </Can>
          )}
          {canCancel && (
            <Can permission="sales:invoice">
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban /> {t('sales.invoices.cancel')}
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
            title={t('sales.invoices.document')}
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
              label: t('sales.customer'),
            }}
          >
            <Field label={t('sales.invoices.date')}>{formatDate(invoice.invoiceDate)}</Field>
            <Field label={t('sales.invoices.dueDate')}>
              <span className={invoice.overdue ? 'text-destructive font-medium' : ''}>
                {formatDate(invoice.dueDate)}
              </span>
            </Field>
            {(invoice.partnerTaxNumber || invoice.partnerTaxOffice) && (
              <Field label={t('sales.invoices.taxInfo')}>
                {[invoice.partnerTaxOffice, invoice.partnerTaxNumber].filter(Boolean).join(' / ')}
              </Field>
            )}
            {invoice.partnerAddress && (
              <Field label={t('sales.invoices.address')}>
                <span className="whitespace-pre-line">{invoice.partnerAddress}</span>
              </Field>
            )}
            <Field label={t('trade.currency')}>
              {invoice.currencyCode}
              {invoice.currencyCode !== base && ` · ${Number(invoice.exchangeRate)}`}
            </Field>
            {invoice.orderId && (
              <Field label={t('sales.orders.single')}>
                {can('sales:read') ? (
                  <Link
                    to="/sales/orders/$id"
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
            <Field label={t('sales.invoices.collected')}>
              {formatMoney(invoice.paidAmount, invoice.currencyCode)}
            </Field>
            <Field label={t('sales.orders.createdBy')}>
              {invoice.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(invoice.createdAt)}
              </span>
            </Field>
            {invoice.cancelledAt && (
              <Field label={t('sales.invoices.cancelledAt')}>
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
          <DocumentLinesTable
            lines={invoice.lines}
            currency={invoice.currencyCode}
            extra={
              hasReturns
                ? [
                    {
                      header: t('sales.invoices.returned'),
                      cell: (line: SalesInvoiceLineDto) =>
                        Number(line.returnedQty) > 0
                          ? formatQuantity(line.returnedQty, line.unitCode ?? undefined)
                          : '—',
                    },
                  ]
                : []
            }
          />
          <DocumentTotals
            totals={{ ...invoice, vatBreakdown: storedBreakdown(invoice.lines) }}
            currency={invoice.currencyCode}
            baseTotal={invoice.grandTotalBase}
            baseCurrency={base}
          />
        </CardContent>
      </Card>

      {invoice.returns.length > 0 && (
        <Card className="mt-4 max-w-xl print:hidden">
          <CardHeader>
            <CardTitle className="text-base">
              {t('sales.returns.title')} ({invoice.returns.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoice.returns.map((item) => (
              <Link
                key={item.id}
                to="/sales/returns/$id"
                params={{ id: item.id }}
                className="hover:bg-muted flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <code className="text-xs">{item.number}</code>
                <span className="text-muted-foreground">{formatDate(item.date)}</span>
                {item.total && (
                  <span className="tabular-nums">
                    {formatMoney(item.total, invoice.currencyCode)}
                  </span>
                )}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('sales.invoices.cancelTitle', { number: invoice.number })}
        description={t('sales.invoices.cancelHint')}
        pending={cancel.isPending}
        onConfirm={onCancel}
      />
    </>
  );
}
