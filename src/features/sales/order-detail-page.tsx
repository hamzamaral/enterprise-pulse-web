import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, CheckCheck, FileText, Lock, Pencil, Printer, Truck } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getStockFindLevelsQueryKey,
  getStockSummaryQueryKey,
} from '@/api/generated/endpoints/inventory/inventory';
import {
  getSalesOrdersFindAllQueryKey,
  getSalesOrdersFindOneQueryKey,
  useSalesOrdersApprove,
  useSalesOrdersCancel,
  useSalesOrdersFindOne,
  useSalesOrdersReserve,
} from '@/api/generated/endpoints/sales/sales';
import type { InvoiceStatus, SalesOrderLineDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { ProgressCell } from '@/features/purchasing/orders-page';
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
import {
  CancelDocumentDialog,
  InvoiceStatusBadge,
  useBaseCurrency,
} from '@/features/trade/trade-components';
import { CreditCard, SalesOrderStatusBadge } from './sales-components';

const DELIVERABLE = ['APPROVED', 'PARTIALLY_DELIVERED'];
const INVOICEABLE = ['APPROVED', 'PARTIALLY_DELIVERED', 'DELIVERED'];

const isGoods = (line: SalesOrderLineDto) => line.productType !== 'SERVICE';

/** Quantity still open on a line: goods up to delivered, services up to ordered. */
export const openToInvoice = (line: SalesOrderLineDto) =>
  Math.max(
    0,
    (isGoods(line) ? Number(line.deliveredQty) : Number(line.quantity)) - Number(line.invoicedQty),
  );

/** Goods still to deliver on a line. */
export const openToDeliver = (line: SalesOrderLineDto) =>
  isGoods(line) ? Math.max(0, Number(line.quantity) - Number(line.deliveredQty)) : 0;

function Progress({ done, total, unit }: { done: string; total: string; unit?: string }) {
  const complete = Number(done) >= Number(total);
  return (
    <span className={cn(complete && 'text-emerald-700 dark:text-emerald-400')}>
      {formatQuantity(done, unit)}
    </span>
  );
}

export function SalesOrderDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const [cancelling, setCancelling] = useState(false);
  const { data: order, isLoading } = useSalesOrdersFindOne(id);
  const approve = useSalesOrdersApprove();
  const reserve = useSalesOrdersReserve();
  const cancel = useSalesOrdersCancel();

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
    invalidate(
      getSalesOrdersFindOneQueryKey(id),
      getSalesOrdersFindAllQueryKey(),
      getStockFindLevelsQueryKey(),
      getStockSummaryQueryKey(),
    );
  const onApprove = () =>
    approve.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('sales.orders.approved'));
          await refresh();
        },
      },
    );
  const onReserve = () =>
    reserve.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('sales.orders.reserved'));
          await refresh();
        },
      },
    );
  const onCancel = (reason?: string) =>
    cancel.mutate(
      { id, data: { reason } },
      {
        onSuccess: async () => {
          toast.success(t('sales.orders.cancelled'));
          setCancelling(false);
          await refresh();
        },
      },
    );

  const open = DELIVERABLE.includes(order.status);
  const canDeliver = open && order.lines.some((line) => openToDeliver(line) > 0);
  const canReserve =
    open && order.lines.some((line) => openToDeliver(line) > Number(line.reservedQty));
  const canInvoice =
    INVOICEABLE.includes(order.status) && order.lines.some((line) => openToInvoice(line) > 0);
  const canCancel =
    (order.status === 'DRAFT' || order.status === 'APPROVED') &&
    !order.deliveries.length &&
    !order.invoices.some((invoice) => invoice.status !== 'CANCELLED');

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/sales/orders"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('sales.orders.title')}
        </Link>
        <div className="flex flex-wrap gap-2">
          {order.status === 'DRAFT' && (
            <>
              <Can permission="sales:update">
                <Button variant="outline" asChild>
                  <Link to="/sales/orders/edit/$id" params={{ id }}>
                    <Pencil /> {t('common.edit')}
                  </Link>
                </Button>
              </Can>
              <Can permission="sales:approve">
                <Button disabled={approve.isPending} onClick={onApprove}>
                  <CheckCheck /> {t('sales.orders.approve')}
                </Button>
              </Can>
            </>
          )}
          {canDeliver && (
            <Can permission="sales:deliver">
              <Button asChild>
                <Link to="/sales/deliveries/new" search={{ orderId: id }}>
                  <Truck /> {t('sales.deliveries.new')}
                </Link>
              </Button>
            </Can>
          )}
          {canReserve && (
            <Can permission={['sales:approve', 'sales:deliver']}>
              <Button variant="outline" disabled={reserve.isPending} onClick={onReserve}>
                <Lock /> {t('sales.orders.reserve')}
              </Button>
            </Can>
          )}
          {canInvoice && (
            <Can permission="sales:invoice">
              <Button variant="outline" asChild>
                <Link to="/sales/invoices/new" search={{ orderId: id }}>
                  <FileText /> {t('sales.invoices.new')}
                </Link>
              </Button>
            </Can>
          )}
          {canCancel && (
            <Can permission="sales:update">
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban /> {t('sales.orders.cancel')}
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
            title={t('sales.orders.document')}
            number={order.number}
            status={<SalesOrderStatusBadge status={order.status} />}
            partner={{
              code: order.partnerCode,
              title: order.partnerTitle,
              label: t('sales.customer'),
            }}
          >
            <Field label={t('trade.date')}>{formatDate(order.orderDate)}</Field>
            <Field label={t('sales.orders.deliveryDate')}>{formatDate(order.deliveryDate)}</Field>
            <Field label={t('sales.orders.warehouse')}>{order.warehouseName}</Field>
            <Field label={t('trade.currency')}>
              {order.currencyCode}
              {order.currencyCode !== base && ` · ${Number(order.exchangeRate)}`}
            </Field>
            {order.customerRef && (
              <Field label={t('sales.orders.customerRef')}>{order.customerRef}</Field>
            )}
            {order.quoteId && (
              <Field label={t('sales.quotes.single')}>
                <Link
                  to="/sales/quotes/$id"
                  params={{ id: order.quoteId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {order.quoteNumber}
                </Link>
              </Field>
            )}
            <Field label={t('sales.orders.createdBy')}>{order.createdByName}</Field>
            <Field label={t('sales.orders.approvedBy')}>
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
                    ...(open
                      ? [
                          {
                            header: t('sales.orders.reservedQty'),
                            cell: (line: SalesOrderLineDto) =>
                              isGoods(line) ? (
                                <span
                                  className={cn(
                                    Number(line.reservedQty) < openToDeliver(line) &&
                                      'text-amber-700 dark:text-amber-400',
                                  )}
                                >
                                  {formatQuantity(line.reservedQty, line.unitCode ?? undefined)}
                                </span>
                              ) : (
                                '—'
                              ),
                          },
                        ]
                      : []),
                    {
                      header: t('sales.orders.delivered'),
                      cell: (line: SalesOrderLineDto) =>
                        isGoods(line) ? (
                          <Progress
                            done={line.deliveredQty}
                            total={line.quantity}
                            unit={line.unitCode ?? undefined}
                          />
                        ) : (
                          '—'
                        ),
                    },
                    {
                      header: t('sales.orders.invoiced'),
                      cell: (line: SalesOrderLineDto) => (
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
                <div className="text-muted-foreground text-xs">{t('sales.orders.delivered')}</div>
                <ProgressCell percent={order.deliveredPercent} />
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

      <div className="mt-4 grid gap-4 md:grid-cols-3 print:hidden">
        <CreditCard credit={order.credit} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('sales.deliveries.title')} ({order.deliveries.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.deliveries.map((delivery) => (
              <Link
                key={delivery.id}
                to="/sales/deliveries/$id"
                params={{ id: delivery.id }}
                className="hover:bg-muted flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <code className="text-xs">{delivery.number}</code>
                <span className="text-muted-foreground">{formatDate(delivery.date)}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t('sales.invoices.title')} ({order.invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.invoices.map((invoice) => (
              <Link
                key={invoice.id}
                to="/sales/invoices/$id"
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

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('sales.orders.cancelTitle', { number: order.number })}
        description={t('sales.orders.cancelHint')}
        pending={cancel.isPending}
        onConfirm={onCancel}
      />
    </>
  );
}
