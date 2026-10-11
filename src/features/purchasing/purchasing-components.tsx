import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useWatch, type Control, type FieldValues, type Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSettingsFindCurrencies } from '@/api/generated/endpoints/settings/settings';
import type {
  InvoiceStatus,
  PaymentStatus,
  PurchaseOrderStatus,
  PurchaseRequestStatus,
  SupplierQuoteStatus,
} from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';

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
const INVOICE_TONES: Record<InvoiceStatus, Tone> = {
  DRAFT: 'neutral',
  ISSUED: 'info',
  CANCELLED: 'danger',
};
const PAYMENT_TONES: Record<PaymentStatus, Tone> = {
  UNPAID: 'warning',
  PARTIALLY_PAID: 'info',
  PAID: 'success',
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

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={INVOICE_TONES[status]}>{t(`trade.invoiceStatus.${status}`)}</ToneBadge>;
}

export function PaymentStatusBadge({
  status,
  overdue,
}: {
  status: PaymentStatus;
  overdue?: boolean;
}) {
  const { t } = useTranslation();
  if (overdue) return <ToneBadge tone="danger">{t('trade.overdue')}</ToneBadge>;
  return <ToneBadge tone={PAYMENT_TONES[status]}>{t(`trade.paymentStatus.${status}`)}</ToneBadge>;
}

/** Company (base) currency of the active company. */
export function useBaseCurrency(): string {
  const { data: me } = useMe();
  return me?.companies.find((c) => c.id === me.activeCompanyId)?.baseCurrency ?? 'TRY';
}

export const today = () => new Date().toISOString().slice(0, 10);

/** Currency select plus an exchange rate field that only appears for foreign currencies. */
export function CurrencyFields<T extends FieldValues>({
  control,
  currencyName,
  rateName,
}: {
  control: Control<T>;
  currencyName: Path<T>;
  rateName: Path<T>;
}) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const { data: currencies } = useSettingsFindCurrencies();
  const currency = useWatch({ control, name: currencyName }) as string;
  return (
    <>
      <FormField
        control={control}
        name={currencyName}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('trade.currency')}</FormLabel>
            <Select value={field.value as string} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(currencies ?? [])
                  .filter((c) => c.isActive)
                  .map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      {currency && currency !== base && (
        <FormField
          control={control}
          name={rateName}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('trade.exchangeRate', { base })}</FormLabel>
              <FormControl>
                <Input
                  inputMode="decimal"
                  placeholder={t('trade.exchangeRateAuto')}
                  {...field}
                  value={field.value as string}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}

/** Optional exchange rate input → number (decimal comma allowed), undefined when empty. */
export const toRate = (value: string) => {
  const parsed = Number(value.replace(',', '.'));
  return value.trim() && parsed > 0 ? parsed : undefined;
};

/** Asks for an optional reason before cancelling a document. */
export function CancelDocumentDialog({
  open,
  onOpenChange,
  title,
  description,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  pending?: boolean;
  onConfirm: (reason: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('');
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel-reason">{t('trade.cancelReason')}</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => onConfirm(reason.trim() || undefined)}
          >
            {pending && <Loader2 className="animate-spin" />}
            {t('trade.cancelDocument')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
