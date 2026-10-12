import { Link } from '@tanstack/react-router';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStockMovementsFindOne } from '@/api/generated/endpoints/inventory/inventory';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { RecordNotFound } from '@/shared/components/route-error';
import { itemName, MovementTypeBadge, SignedQuantity } from './inventory-components';
import { WarehouseRoute } from './movements-page';

export function MovementDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const { data: movement, isLoading } = useStockMovementsFindOne(id);

  if (!movement) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const signed = movement.type === 'ADJUSTMENT';
  const hasLots = movement.lines.some((line) => line.lotNo);
  const hasSerials = movement.lines.some((line) => line.serialNos.length);

  return (
    <>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link
          to="/inventory/movements"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('inventory.movements.title')}
        </Link>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer /> {t('inventory.movements.print')}
        </Button>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 pt-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-muted-foreground text-xs uppercase">
                {t('inventory.movements.document')}
              </div>
              <h1 className="font-mono text-xl font-semibold">{movement.number}</h1>
            </div>
            <MovementTypeBadge type={movement.type} />
          </header>

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('inventory.movements.date')}>{formatDate(movement.movementDate)}</Field>
            <Field label={t('inventory.warehouse')}>
              <WarehouseRoute movement={movement} />
            </Field>
            <Field label={t('inventory.movements.reference')}>{movement.reference}</Field>
            <Field label={t('inventory.movements.createdBy')}>
              {movement.createdByName}
              <span className="text-muted-foreground block text-xs">
                {formatDateTime(movement.createdAt)}
              </span>
            </Field>
            {movement.stockCountId && (
              <Field label={t('inventory.movements.fromCount')}>
                <Link
                  to="/inventory/counts/$id"
                  params={{ id: movement.stockCountId }}
                  className="text-primary font-mono text-xs hover:underline"
                >
                  {movement.stockCountNumber}
                </Link>
              </Field>
            )}
            {movement.notes && (
              <div className="sm:col-span-2 lg:col-span-4">
                <Field label={t('common.notes')}>{movement.notes}</Field>
              </div>
            )}
          </dl>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{t('inventory.sku')}</TableHead>
                  <TableHead>{t('inventory.product')}</TableHead>
                  {hasLots && <TableHead>{t('inventory.movements.lot')}</TableHead>}
                  {hasSerials && <TableHead>{t('inventory.movements.serials')}</TableHead>}
                  <TableHead className="text-right">{t('inventory.quantity')}</TableHead>
                  <TableHead className="text-right">{t('inventory.movements.unitCost')}</TableHead>
                  <TableHead className="text-right">{t('inventory.movements.lineValue')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movement.lines.map((line, index) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell>
                      <code className="text-xs">{line.sku}</code>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/inventory/products/$id"
                        params={{ id: line.productId }}
                        className="hover:underline print:no-underline"
                      >
                        {itemName(line.productName, line.variantName)}
                      </Link>
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
                    <TableCell className="text-right">
                      {signed ? (
                        <SignedQuantity value={line.quantity} unit={line.unitCode} />
                      ) : (
                        <span className="tabular-nums">
                          {formatQuantity(line.quantity, line.unitCode)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.unitCost)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.lineValue)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={5 + Number(hasLots) + Number(hasSerials)}
                    className="text-right font-medium"
                  >
                    {t('inventory.movements.totalValue')}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {formatMoney(movement.totalValue)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
