import { useTranslation } from 'react-i18next';
import { formatMoney } from '@/shared/lib/format';
import type { DocumentAmounts } from './document-math';

interface TotalsValues {
  subtotal: number | string;
  discountTotal: number | string;
  vatTotal: number | string;
  grandTotal: number | string;
  vatBreakdown?: DocumentAmounts['vatBreakdown'];
}

/** Subtotal, discount, VAT (per rate when given) and grand total, right aligned. */
export function DocumentTotals({
  totals,
  currency,
  baseTotal,
  baseCurrency,
}: {
  totals: TotalsValues;
  currency: string;
  /** Grand total in the company currency, shown for foreign currency documents. */
  baseTotal?: number | string;
  baseCurrency?: string;
}) {
  const { t } = useTranslation();
  const row = (label: string, value: number | string, strong = false) => (
    <div
      className={`flex justify-between gap-8 ${strong ? 'border-t pt-2 text-base font-semibold' : ''}`}
    >
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{formatMoney(value, currency)}</span>
    </div>
  );
  return (
    <div className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
      {row(t('trade.subtotal'), totals.subtotal)}
      {Number(totals.discountTotal) > 0 &&
        row(t('trade.discountTotal'), -Number(totals.discountTotal))}
      {totals.vatBreakdown?.length
        ? totals.vatBreakdown
            .filter((b) => b.vat > 0)
            .map((b) => (
              <div key={b.rate}>{row(t('trade.vatAtRate', { rate: b.rate }), b.vat)}</div>
            ))
        : row(t('trade.vatTotal'), totals.vatTotal)}
      {row(t('trade.grandTotal'), totals.grandTotal, true)}
      {baseTotal !== undefined && baseCurrency && baseCurrency !== currency && (
        <div className="text-muted-foreground flex justify-between gap-8 text-xs">
          <span>{t('trade.baseTotal', { currency: baseCurrency })}</span>
          <span className="tabular-nums">{formatMoney(baseTotal, baseCurrency)}</span>
        </div>
      )}
    </div>
  );
}
