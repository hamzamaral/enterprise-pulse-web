import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePaymentsCancel, usePaymentsFindOne } from '@/api/generated/endpoints/finance/finance';
import type { PaymentDirection } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DocumentHeader } from '@/features/trade/document-print';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { CancelDocumentDialog, useBaseCurrency } from '@/features/trade/trade-components';
import { paymentBase, RecordStatusBadge, useInvalidateFinance } from './finance-components';

export function PaymentDetailPage({ id, direction }: { id: string; direction: PaymentDirection }) {
  const { t } = useTranslation();
  const can = usePermission();
  const base = useBaseCurrency();
  const invalidateFinance = useInvalidateFinance();
  const [cancelling, setCancelling] = useState(false);
  const { data: item, isLoading } = usePaymentsFindOne(id);
  const cancel = usePaymentsCancel();
  const incoming = direction === 'IN';

  if (isLoading || !item) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const unallocated = Number(item.amount) - Number(item.allocatedAmount);
  const invoiceLink = (invoiceId: string, number: string) => {
    const className = 'text-primary font-mono text-xs hover:underline print:no-underline';
    if (incoming && can(['sales:read', 'finance:read'])) {
      return (
        <Link to="/sales/invoices/$id" params={{ id: invoiceId }} className={className}>
          {number}
        </Link>
      );
    }
    if (!incoming && can(['purchasing:read', 'finance:read'])) {
      return (
        <Link to="/purchasing/invoices/$id" params={{ id: invoiceId }} className={className}>
          {number}
        </Link>
      );
    }
    return <code className="text-xs">{number}</code>;
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to={paymentBase(direction)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" />{' '}
          {incoming ? t('finance.payments.collectionsTitle') : t('finance.payments.paymentsTitle')}
        </Link>
        <div className="flex gap-2">
          {item.status === 'POSTED' && (
            <Can permission="finance:approve">
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <Ban /> {t('trade.cancelDocument')}
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
            title={incoming ? t('finance.payments.collection') : t('finance.payments.payment')}
            number={item.number}
            status={<RecordStatusBadge status={item.status} />}
            partner={{
              code: item.partnerCode,
              title: item.partnerTitle,
              label: incoming ? t('finance.payments.customer') : t('finance.payments.supplier'),
            }}
          >
            <Field label={t('finance.payments.date')}>{formatDate(item.paymentDate)}</Field>
            <Field label={t('finance.payments.method')}>
              {t(`finance.methods.${item.method}`)}
            </Field>
            {item.accountId && (
              <Field label={t('finance.payments.account')}>
                {can('finance:read') ? (
                  <Link
                    to="/finance/accounts/$id"
                    params={{ id: item.accountId }}
                    className="text-primary hover:underline print:no-underline"
                  >
                    {item.accountName}
                  </Link>
                ) : (
                  item.accountName
                )}
              </Field>
            )}
            {item.chequeId && (
              <Field label={t('finance.payments.cheque')}>
                <Link
                  to="/finance/cheques/$id"
                  params={{ id: item.chequeId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {item.chequeNumber}
                </Link>
              </Field>
            )}
            <Field label={t('finance.payments.amount')}>
              <span className="text-lg font-semibold tabular-nums">
                {formatMoney(item.amount, item.currencyCode)}
              </span>
              {item.currencyCode !== base && (
                <span className="text-muted-foreground block text-xs tabular-nums">
                  × {Number(item.exchangeRate)} = {formatMoney(item.amountBase, base)}
                </span>
              )}
            </Field>
            <Field label={t('finance.payments.createdBy')}>
              {item.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(item.createdAt)}
              </span>
            </Field>
            {item.description && (
              <div className="sm:col-span-2">
                <Field label={t('common.description')}>
                  <span className="whitespace-pre-line">{item.description}</span>
                </Field>
              </div>
            )}
          </DocumentHeader>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">{t('finance.payments.allocations')}</h3>
            {item.allocations.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t('finance.payments.noAllocations')}</p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('finance.payments.invoice')}</TableHead>
                      <TableHead>{t('finance.payments.invoiceDate')}</TableHead>
                      <TableHead>{t('finance.payments.dueDate')}</TableHead>
                      <TableHead className="text-right">
                        {t('finance.payments.invoiceTotal')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('finance.payments.allocated')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.allocations.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{invoiceLink(a.invoiceId, a.invoiceNumber)}</TableCell>
                        <TableCell>{formatDate(a.invoiceDate)}</TableCell>
                        <TableCell>{formatDate(a.dueDate)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(a.invoiceTotal, item.currencyCode)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(a.amount, item.currencyCode)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <div className="flex justify-end gap-6 text-sm tabular-nums">
              <span>
                {t('finance.payments.allocated')}:{' '}
                <strong>{formatMoney(item.allocatedAmount, item.currencyCode)}</strong>
              </span>
              <span>
                {t('finance.payments.unallocated')}:{' '}
                <strong>{formatMoney(unallocated, item.currencyCode)}</strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <CancelDocumentDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={t('finance.payments.cancelTitle')}
        description={t('finance.payments.cancelDescription')}
        pending={cancel.isPending}
        onConfirm={(reason) =>
          cancel.mutate(
            { id, data: { reason } },
            {
              onSuccess: async () => {
                toast.success(t('finance.payments.cancelled'));
                setCancelling(false);
                await invalidateFinance();
              },
            },
          )
        }
      />
    </>
  );
}
