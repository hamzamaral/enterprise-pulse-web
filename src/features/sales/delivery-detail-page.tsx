import { Link } from '@tanstack/react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useDeliveryNotesFindOne } from '@/api/generated/endpoints/sales/sales';
import { usePermission } from '@/features/auth/use-session';
import { DocumentHeader } from '@/features/trade/document-print';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { RecordNotFound } from '@/shared/components/route-error';

export function DeliveryDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const { data: note, isLoading } = useDeliveryNotesFindOne(id);

  if (!note) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const hasLots = note.lines.some((line) => line.lotNo);
  const hasSerials = note.lines.some((line) => line.serialNos.length);

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to="/sales/deliveries"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('sales.deliveries.title')}
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> {t('trade.print')}
        </Button>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 pt-6">
          <DocumentHeader
            title={t('sales.deliveries.document')}
            number={note.number}
            partner={{
              code: note.partnerCode,
              title: note.partnerTitle,
              label: t('sales.customer'),
            }}
          >
            <Field label={t('sales.deliveries.date')}>{formatDate(note.deliveryDate)}</Field>
            <Field label={t('sales.orders.warehouse')}>{note.warehouseName}</Field>
            <Field label={t('sales.orders.single')}>
              {can('sales:read') ? (
                <Link
                  to="/sales/orders/$id"
                  params={{ id: note.orderId }}
                  className="text-primary font-mono text-xs hover:underline print:no-underline"
                >
                  {note.orderNumber}
                </Link>
              ) : (
                <code className="text-xs">{note.orderNumber}</code>
              )}
            </Field>
            <Field label={t('sales.deliveries.carrier')}>{note.carrier}</Field>
            <div className="sm:col-span-2">
              <Field label={t('sales.deliveries.shippingAddress')}>
                <span className="whitespace-pre-line">
                  {note.shippingAddress ?? note.partnerAddress}
                </span>
              </Field>
            </div>
            <Field label={t('sales.deliveries.movement')}>
              {note.stockMovementId && note.stockMovementNumber ? (
                can('inventory:read') ? (
                  <Link
                    to="/inventory/movements/$id"
                    params={{ id: note.stockMovementId }}
                    className="text-primary font-mono text-xs hover:underline print:no-underline"
                  >
                    {note.stockMovementNumber}
                  </Link>
                ) : (
                  <code className="text-xs">{note.stockMovementNumber}</code>
                )
              ) : null}
            </Field>
            <Field label={t('sales.orders.createdBy')}>
              {note.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(note.createdAt)}
              </span>
            </Field>
            {note.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label={t('common.notes')}>{note.notes}</Field>
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
                {note.lines.map((line, index) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>
                      {line.description}
                    </TableCell>
                    {hasLots && (
                      <TableCell>
                        {line.lotNo ? <code className="text-xs">{line.lotNo}</code> : '—'}
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
            <div className="border-t pt-2">{t('sales.deliveries.deliveredBy')}</div>
            <div className="border-t pt-2">{t('sales.deliveries.receivedBy')}</div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
