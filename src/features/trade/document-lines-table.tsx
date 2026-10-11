import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney, formatQuantity } from '@/shared/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

export interface TradeLineDto {
  id: string;
  lineNo: number;
  sku: string | null;
  unitCode: string | null;
  description: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  vatRate: string;
  lineTotal: string;
}

export interface ExtraLineColumn<T> {
  header: string;
  cell: (line: T) => ReactNode;
}

/** Read-only priced lines of a stored document, with optional extra columns (received, …). */
export function DocumentLinesTable<T extends TradeLineDto>({
  lines,
  currency,
  extra = [],
}: {
  lines: T[];
  currency: string;
  extra?: ExtraLineColumn<T>[];
}) {
  const { t } = useTranslation();
  const discounted = lines.some((line) => Number(line.discountRate) > 0);
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{t('trade.item')}</TableHead>
            <TableHead className="text-right">{t('trade.quantity')}</TableHead>
            {extra.map((column) => (
              <TableHead key={column.header} className="text-right">
                {column.header}
              </TableHead>
            ))}
            <TableHead className="text-right">{t('trade.unitPrice')}</TableHead>
            {discounted && <TableHead className="text-right">{t('trade.discountShort')}</TableHead>}
            <TableHead className="text-right">{t('trade.vatShort')}</TableHead>
            <TableHead className="text-right">{t('trade.lineTotal')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell className="text-muted-foreground">{line.lineNo}</TableCell>
              <TableCell>
                {line.sku && <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>}
                {line.description}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatQuantity(line.quantity, line.unitCode ?? undefined)}
              </TableCell>
              {extra.map((column) => (
                <TableCell key={column.header} className="text-right tabular-nums">
                  {column.cell(line)}
                </TableCell>
              ))}
              <TableCell className="text-right tabular-nums">
                {formatMoney(line.unitPrice, currency)}
              </TableCell>
              {discounted && (
                <TableCell className="text-right tabular-nums">
                  {Number(line.discountRate) ? `%${Number(line.discountRate)}` : '—'}
                </TableCell>
              )}
              <TableCell className="text-right tabular-nums">%{Number(line.vatRate)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(line.lineTotal, currency)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
