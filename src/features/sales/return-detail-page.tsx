import { Link } from '@tanstack/react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSalesReturnsFindOne } from '@/api/generated/endpoints/sales/sales';
import type { SalesReturnLineDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { DocumentLinesTable } from '@/features/trade/document-lines-table';
import { storedBreakdown } from '@/features/trade/document-math';
import { DocumentHeader } from '@/features/trade/document-print';
import { DocumentTotals } from '@/features/trade/document-totals';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { useBaseCurrency } from '@/features/trade/trade-components';

export function SalesReturnDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const base = useBaseCurrency();
  const { data: item, isLoading } = useSalesReturnsFindOne(id);

  if (isLoading || !item) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const tracked = item.lines.some((line) => line.lotNo || line.serialNos.length);

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to="/sales/returns"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('sales.returns.title')}
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> {t('trade.print')}
        </Button>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 pt-6">
          <DocumentHeader
            title={t('sales.returns.document')}
            number={item.number}
            partner={{
              code: item.partnerCode,
              title: item.partnerTitle,
              label: t('sales.customer'),
            }}
          >
            <Field label={t('sales.returns.date')}>{formatDate(item.returnDate)}</Field>
            <Field label={t('sales.invoices.single')}>
              {can(['sales:read', 'finance:read']) ? (
                <Link
                  to="/sales/invoices/$id"
                  params={{ id: item.invoiceId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {item.invoiceNumber}
                </Link>
              ) : (
                <code className="text-xs">{item.invoiceNumber}</code>
              )}
            </Field>
            <Field label={t('sales.returns.warehouse')}>{item.warehouseName}</Field>
            <Field label={t('sales.deliveries.movement')}>
              {item.stockMovementId && item.stockMovementNumber ? (
                can('inventory:read') ? (
                  <Link
                    to="/inventory/movements/$id"
                    params={{ id: item.stockMovementId }}
                    className="text-primary font-mono text-xs hover:underline print:no-underline"
                  >
                    {item.stockMovementNumber}
                  </Link>
                ) : (
                  <code className="text-xs">{item.stockMovementNumber}</code>
                )
              ) : null}
            </Field>
            <Field label={t('trade.currency')}>
              {item.currencyCode}
              {item.currencyCode !== base && ` · ${Number(item.exchangeRate)}`}
            </Field>
            <Field label={t('sales.orders.createdBy')}>
              {item.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(item.createdAt)}
              </span>
            </Field>
            <div className="sm:col-span-2">
              <Field label={t('sales.returns.reason')}>
                <span className="whitespace-pre-line">{item.reason}</span>
              </Field>
            </div>
          </DocumentHeader>
          <DocumentLinesTable
            lines={item.lines}
            currency={item.currencyCode}
            extra={
              tracked
                ? [
                    {
                      header: t('sales.returns.tracking'),
                      cell: (line: SalesReturnLineDto) => (
                        <span className="font-mono text-xs break-words">
                          {[line.lotNo, ...line.serialNos].filter(Boolean).join(', ') || '—'}
                        </span>
                      ),
                    },
                  ]
                : []
            }
          />
          <DocumentTotals
            totals={{ ...item, vatBreakdown: storedBreakdown(item.lines) }}
            currency={item.currencyCode}
            baseTotal={item.grandTotalBase}
            baseCurrency={base}
          />
        </CardContent>
      </Card>
    </>
  );
}
