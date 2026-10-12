import { Link } from '@tanstack/react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGoodsReceiptsFindOne } from '@/api/generated/endpoints/purchasing/purchasing';
import { usePermission } from '@/features/auth/use-session';
import { DocumentHeader } from '@/features/trade/document-print';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { RecordNotFound } from '@/shared/components/route-error';

export function ReceiptDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const { data: receipt, isLoading } = useGoodsReceiptsFindOne(id);

  if (!receipt) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasLots = receipt.lines.some((line) => line.lotNo);
  const hasSerials = receipt.lines.some((line) => line.serialNos.length);

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to="/purchasing/receipts"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('purchasing.receipts.title')}
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> {t('trade.print')}
        </Button>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 pt-6">
          <DocumentHeader
            title={t('purchasing.receipts.document')}
            number={receipt.number}
            partner={{
              title: receipt.partnerTitle,
              label: t('purchasing.supplier'),
            }}
          >
            <Field label={t('purchasing.receipts.date')}>{formatDate(receipt.receiptDate)}</Field>
            <Field label={t('purchasing.orders.warehouse')}>{receipt.warehouseName}</Field>
            <Field label={t('purchasing.orders.single')}>
              <Link
                to="/purchasing/orders/$id"
                params={{ id: receipt.orderId }}
                className="text-primary font-mono text-xs hover:underline print:no-underline"
              >
                {receipt.orderNumber}
              </Link>
            </Field>
            <Field label={t('purchasing.receipts.deliveryNoteNo')}>{receipt.deliveryNoteNo}</Field>
            <Field label={t('purchasing.receipts.movement')}>
              {receipt.stockMovementId && receipt.stockMovementNumber ? (
                can('inventory:read') ? (
                  <Link
                    to="/inventory/movements/$id"
                    params={{ id: receipt.stockMovementId }}
                    className="text-primary font-mono text-xs hover:underline print:no-underline"
                  >
                    {receipt.stockMovementNumber}
                  </Link>
                ) : (
                  <code className="text-xs">{receipt.stockMovementNumber}</code>
                )
              ) : null}
            </Field>
            <Field label={t('purchasing.orders.createdBy')}>
              {receipt.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(receipt.createdAt)}
              </span>
            </Field>
            {receipt.notes && (
              <div className="sm:col-span-2">
                <Field label={t('common.notes')}>{receipt.notes}</Field>
              </div>
            )}
          </DocumentHeader>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{t('trade.item')}</TableHead>
                  {hasLots && <TableHead>{t('inventory.movements.lot')}</TableHead>}
                  {hasSerials && <TableHead>{t('inventory.movements.serials')}</TableHead>}
                  <TableHead className="text-right">{t('trade.quantity')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipt.lines.map((line, index) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>
                      {line.description}
                    </TableCell>
                    {hasLots && (
                      <TableCell>
                        {line.lotNo ? (
                          <>
                            <code className="text-xs">{line.lotNo}</code>
                            {line.expiryDate && (
                              <span className="text-muted-foreground block text-xs">
                                {t('inventory.movements.expiryShort')} {formatDate(line.expiryDate)}
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    )}
                    {hasSerials && (
                      <TableCell className="max-w-56">
                        <span className="font-mono text-xs break-words">
                          {line.serialNos.join(', ') || '—'}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums">
                      {formatQuantity(line.quantity, line.unitCode)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="hidden grid-cols-2 gap-16 pt-16 text-center text-sm print:grid">
            <div className="border-t pt-2">{t('purchasing.receipts.deliveredBy')}</div>
            <div className="border-t pt-2">{t('purchasing.receipts.receivedBy')}</div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
