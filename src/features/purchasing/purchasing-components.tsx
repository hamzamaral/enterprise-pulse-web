import { useTranslation } from 'react-i18next';
import type {
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  SupplierQuoteStatus,
} from '@/api/generated/model';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';

const REQUEST_TONES: Record<PurchaseRequestStatus, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  ORDERED: 'info',
};
const QUOTE_TONES: Record<SupplierQuoteStatus, Tone> = {
  OPEN: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'neutral',
};
const ORDER_TONES: Record<PurchaseOrderStatus, Tone> = {
  DRAFT: 'neutral',
  APPROVED: 'info',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  CANCELLED: 'danger',
};
export function RequestStatusBadge({ status }: { status: PurchaseRequestStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={REQUEST_TONES[status]}>{t(`purchasing.requestStatus.${status}`)}</ToneBadge>
  );
}

export function QuoteStatusBadge({ status }: { status: SupplierQuoteStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={QUOTE_TONES[status]}>{t(`purchasing.quoteStatus.${status}`)}</ToneBadge>;
}

export function OrderStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={ORDER_TONES[status]}>{t(`purchasing.orderStatus.${status}`)}</ToneBadge>;
}
