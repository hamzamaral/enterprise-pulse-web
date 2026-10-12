import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, CheckCheck, FileText, PackageCheck, Pencil, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getPurchaseOrdersFindAllQueryKey,
  getPurchaseOrdersFindOneQueryKey,
  usePurchaseOrdersApprove,
  usePurchaseOrdersCancel,
  usePurchaseOrdersFindOne,
} from '@/api/generated/endpoints/purchasing/purchasing';
import type { InvoiceStatus, PurchaseOrderLineDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DocumentLinesTable } from '@/features/trade/document-lines-table';
import { storedBreakdown } from '@/features/trade/document-math';
import { DocumentHeader } from '@/features/trade/document-print';
import { DocumentTotals } from '@/features/trade/document-totals';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { RecordNotFound } from '@/shared/components/route-error';
import { ProgressCell } from './orders-page';
import { OrderStatusBadge } from './purchasing-components';
import {
  CancelDocumentDialog,
  InvoiceStatusBadge,
  useBaseCurrency,
} from '@/features/trade/trade-components';

const RECEIVABLE = ['APPROVED', 'PARTIALLY_RECEIVED'];
const INVOICEABLE = ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED'];

/** Quantity still open on a line: goods up to received, services up to ordered. */
export const openToInvoice = (line: PurchaseOrderLineDto) =>
  Math.max(
    0,
    (line.productType === 'SERVICE' ? Number(line.quantity) : Number(line.receivedQty)) -
      Number(line.invoicedQty),
  );

function Progress({ done, total, unit }: { done: string; total: string; unit?: string }) {
  const complete = Number(done) >= Number(total);
  return (
    <span className={cn(complete ? 'text-emerald-700 dark:text-emerald-400' : '')}>
      {formatQuantity(done, unit)}
    </span>
  );
}

export function OrderDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const [cancelling, setCancelling] = useState(false);
  const { data: order, isLoading } = usePurchaseOrdersFindOne(id);
  const approve = usePurchaseOrdersApprove();
  const cancel = usePurchaseOrdersCancel();

  if (!order) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const refresh = () =>
    invalidate(getPurchaseOrdersFindOneQueryKey(id), getPurchaseOrdersFindAllQueryKey());
  const onApprove = () =>
    approve.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('purchasing.orders.approved'));
          await refresh();
        },
      },
    );
  const onCancel = (reason?: string) =>
    cancel.mutate(
      { id, data: { reason } },
      {
        onSuccess: async () => {
          toast.success(t('purchasing.orders.cancelled'));
          setCancelling(false);
          await refresh();
        },
      },
    );

  const canReceive = RECEIVABLE.includes(order.status);
  const canInvoice =
    INVOICEABLE.includes(order.status) && order.lines.some((line) => openToInvoice(line) > 0);
  const canCancel =
    (order.status === 'DRAFT' || order.status === 'APPROVED') && !order.receipts.length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/purchasing/orders"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('purchasing.orders.title')}
        </Link>
        <div className="flex flex-wrap gap-2">
          {order.status === 'DRAFT' && (
            <>
              <Can permission="purchasing:update">
                <Button variant="outline" asChild>
                  <Link to="/purchasing/orders/edit/$id" params={{ id }}>
                    <Pencil /> {t('common.edit')}
                  </Link>
                </Button>
              </Can>
              <Can permission="purchasing:approve">
                <Button disabled={approve.isPending} onClick={onApprove}>
                  <CheckCheck /> {t('purchasing.orders.approve')}
                </Button>
              </Can>
            </>
          )}
          {canReceive && (
            <Can permission="purchasing:receive">
              <Button asChild>
                <Link to="/purchasing/receipts/new" search={{ orderId: id }}>
                  <PackageCheck /> {t('purchasing.receipts.new')}
                </Link>
              </Button>
            </Can>
          )}
          {canInvoice && (
            <Can permission="purchasing:create">
              <Button variant="outline" asChild>
                <Link to="/purchasing/invoices/new" search={{ orderId: id }}>
                  <FileText /> {t('purchasing.invoices.new')}
                </Link>
              </Button>
            </Can>
          )}
          {canCancel && (
            <Can permission="purchasing:update">
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban /> {t('purchasing.orders.cancel')}
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
            title={t('purchasing.orders.document')}
            number={order.number}
            status={<OrderStatusBadge status={order.status} />}
            partner={{
              code: order.partnerCode,
              title: order.partnerTitle,
              label: t('purchasing.supplier'),
            }}
          >
            <Field label={t('trade.date')}>{formatDate(order.orderDate)}</Field>
            <Field label={t('purchasing.orders.expectedDate')}>
              {formatDate(order.expectedDate)}
            </Field>
            <Field label={t('purchasing.orders.warehouse')}>{order.warehouseName}</Field>
            <Field label={t('trade.currency')}>
              {order.currencyCode}
              {order.currencyCode !== base && ` · ${Number(order.exchangeRate)}`}
            </Field>
            {order.requestId && (
              <Field label={t('purchasing.requests.single')}>
                <Link
                  to="/purchasing/requests/$id"
                  params={{ id: order.requestId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {order.requestNumber}
                </Link>
              </Field>
            )}
            {order.quoteId && (
              <Field label={t('purchasing.quotes.single')}>
                <Link
                  to="/purchasing/quotes/$id"
                  params={{ id: order.quoteId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {order.quoteNumber}
                </Link>
              </Field>
            )}
            <Field label={t('purchasing.orders.createdBy')}>{order.createdByName}</Field>
            <Field label={t('purchasing.orders.approvedBy')}>
              {order.approvedByName}
              {order.approvedAt && (
                <span className="text-muted-foreground block text-xs">
                  {formatDate(order.approvedAt)}
                </span>
              )}
            </Field>
            {order.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label={t('common.notes')}>{order.notes}</Field>
              </div>
            )}
          </DocumentHeader>
          <DocumentLinesTable
            lines={order.lines}
            currency={order.currencyCode}
            extra={
              order.status === 'DRAFT'
                ? []
                : [
                    {
                      header: t('purchasing.orders.received'),
                      cell: (line) => (
                        <Progress
                          done={line.receivedQty}
                          total={line.quantity}
                          unit={line.unitCode ?? undefined}
                        />
                      ),
                    },
                    {
                      header: t('purchasing.orders.invoiced'),
                      cell: (line) => (
                        <Progress
                          done={line.invoicedQty}
                          total={line.quantity}
                          unit={line.unitCode ?? undefined}
                        />
                      ),
                    },
                  ]
            }
          />
          <div className="flex flex-wrap items-start justify-between gap-6">
            {order.status !== 'DRAFT' && (
              <div className="space-y-1 text-sm print:hidden">
                <div className="text-muted-foreground text-xs">
                  {t('purchasing.orders.received')}
                </div>
                <ProgressCell percent={order.receivedPercent} />
              </div>
            )}
            <DocumentTotals
              totals={{ ...order, vatBreakdown: storedBreakdown(order.lines) }}
              currency={order.currencyCode}
              baseTotal={order.grandTotalBase}
              baseCurrency={base}
            />
          </div>
        </CardContent>
      </Card>

      {(order.receipts.length > 0 || order.invoices.length > 0) && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 print:hidden">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('purchasing.receipts.title')} ({order.receipts.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.receipts.map((receipt) => (
                <Link
                  key={receipt.id}
                  to="/purchasing/receipts/$id"
                  params={{ id: receipt.id }}
                  className="hover:bg-muted flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <code className="text-xs">{receipt.number}</code>
                  <span className="text-muted-foreground">{formatDate(receipt.date)}</span>
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('purchasing.invoices.title')} ({order.invoices.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {order.invoices.map((invoice) => (
                <Link
                  key={invoice.id}
                  to="/purchasing/invoices/$id"
                  params={{ id: invoice.id }}
                  className="hover:bg-muted flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <code className="text-xs">{invoice.number}</code>
                  <span className="text-muted-foreground">{formatDate(invoice.date)}</span>
                  <InvoiceStatusBadge status={invoice.status as InvoiceStatus} />
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('purchasing.orders.cancelTitle', { number: order.number })}
        pending={cancel.isPending}
        onConfirm={onCancel}
      />
    </>
  );
}
