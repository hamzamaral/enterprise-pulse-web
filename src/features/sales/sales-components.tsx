import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CreditCheckDto, SalesOrderStatus, SalesQuoteStatus } from '@/api/generated/model';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { useBaseCurrency } from '@/features/trade/trade-components';

const QUOTE_TONES: Record<SalesQuoteStatus, Tone> = {
  OPEN: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'neutral',
};
const ORDER_TONES: Record<SalesOrderStatus, Tone> = {
  DRAFT: 'neutral',
  APPROVED: 'info',
  PARTIALLY_DELIVERED: 'warning',
  DELIVERED: 'success',
  CANCELLED: 'danger',
};

export function SalesQuoteStatusBadge({
  status,
  expired,
}: {
  status: SalesQuoteStatus;
  expired?: boolean;
}) {
  const { t } = useTranslation();
  if (status === 'OPEN' && expired) {
    return <ToneBadge tone="danger">{t('sales.quotes.expired')}</ToneBadge>;
  }
  return <ToneBadge tone={QUOTE_TONES[status]}>{t(`sales.quoteStatus.${status}`)}</ToneBadge>;
}

export function SalesOrderStatusBadge({ status }: { status: SalesOrderStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={ORDER_TONES[status]}>{t(`sales.orderStatus.${status}`)}</ToneBadge>;
}

/** Customer exposure against the credit limit, in the company currency. */
export function CreditCard({ credit }: { credit: CreditCheckDto }) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const rows: [string, string][] = [
    [t('sales.credit.balance'), credit.balance],
    [t('sales.credit.openOrders'), credit.openOrders],
    [t('sales.credit.exposure'), credit.exposure],
  ];
  return (
    <Card className={cn(credit.exceeded && 'border-destructive/50')}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {credit.exceeded && <AlertTriangle className="text-destructive size-4" />}
          {t('sales.credit.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{t('sales.credit.limit')}</span>
          <span className="tabular-nums">
            {credit.creditLimit === null
              ? t('sales.credit.unlimited')
              : formatMoney(credit.creditLimit, base)}
          </span>
        </div>
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{formatMoney(value, base)}</span>
          </div>
        ))}
        {credit.exceeded && (
          <p className="text-destructive pt-1 text-xs">{t('sales.credit.exceeded')}</p>
        )}
      </CardContent>
    </Card>
  );
}
