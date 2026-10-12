import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTreasuryAccountsFindAll } from '@/api/generated/endpoints/finance/finance';
import type {
  ChequeStatus,
  PaymentDirection,
  PaymentRecordStatus,
  TreasuryAccountDto,
  TreasuryAccountType,
} from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { today } from '@/features/trade/trade-components';

const CHEQUE_TONES: Record<ChequeStatus, Tone> = {
  PORTFOLIO: 'info',
  DEPOSITED: 'warning',
  COLLECTED: 'success',
  ENDORSED: 'neutral',
  BOUNCED: 'danger',
  ISSUED: 'warning',
  PAID: 'success',
  CANCELLED: 'danger',
};

export function ChequeStatusBadge({
  status,
  overdue,
}: {
  status: ChequeStatus;
  overdue?: boolean;
}) {
  const { t } = useTranslation();
  if (overdue) return <ToneBadge tone="danger">{t('trade.overdue')}</ToneBadge>;
  return <ToneBadge tone={CHEQUE_TONES[status]}>{t(`finance.chequeStatus.${status}`)}</ToneBadge>;
}

export function RecordStatusBadge({ status }: { status: PaymentRecordStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={status === 'POSTED' ? 'success' : 'danger'}>
      {t(`finance.recordStatus.${status}`)}
    </ToneBadge>
  );
}

export function AccountTypeBadge({ type }: { type: TreasuryAccountType }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={type === 'CASH' ? 'warning' : 'info'}>
      {t(`finance.accountTypes.${type}`)}
    </ToneBadge>
  );
}

const MONEY_QUERY_PREFIXES = [
  '/api/v1/payments',
  '/api/v1/cheques',
  '/api/v1/treasury-accounts',
  '/api/v1/finance-reports',
  '/api/v1/partners',
  '/api/v1/sales-invoices',
  '/api/v1/purchase-invoices',
];

/** Money movements touch balances, invoices and reports alike; refresh all of them. */
export function useInvalidateFinance() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' && MONEY_QUERY_PREFIXES.some((prefix) => key.startsWith(prefix))
        );
      },
    });
}

/** Collections live under /finance/collections, payments under /finance/payments. */
export const paymentBase = (direction: PaymentDirection) =>
  direction === 'IN' ? ('/finance/collections' as const) : ('/finance/payments' as const);

/** Payment number linked to its receipt when the user may open it. */
export function PaymentLink({
  id,
  number,
  direction,
}: {
  id: string;
  number: string;
  direction: PaymentDirection;
}) {
  const can = usePermission();
  if (!can('finance:read')) return <code className="text-xs">{number}</code>;
  return (
    <Link
      to={`${paymentBase(direction)}/$id`}
      params={{ id }}
      className="text-primary font-mono text-xs hover:underline print:no-underline"
    >
      {number}
    </Link>
  );
}

export const accountLabel = (account: Pick<TreasuryAccountDto, 'name' | 'currencyCode'>) =>
  `${account.name} · ${account.currencyCode}`;

/** Active cash / bank accounts, optionally narrowed by type and currency. */
export function useAccountOptions(filter: {
  types?: TreasuryAccountType[];
  currencyCode?: string;
}) {
  const { data } = useTreasuryAccountsFindAll({ activeOnly: true });
  return (data ?? []).filter(
    (a) =>
      (!filter.types || filter.types.includes(a.type)) &&
      (!filter.currencyCode || a.currencyCode === filter.currencyCode),
  );
}

export function AccountSelect({
  value,
  onChange,
  accounts,
  placeholder,
}: {
  value: string;
  onChange: (id: string) => void;
  accounts: TreasuryAccountDto[];
  placeholder?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder ?? t('common.select')} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {accountLabel(account)}{' '}
            <span className="text-muted-foreground">
              ({formatMoney(account.balance, account.currencyCode)})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface ChequeActionValues {
  date: string;
  accountId?: string;
  note?: string;
}

interface ChequeActionProps {
  title: string;
  description: string;
  /** Omit when the step needs no account. */
  accounts?: TreasuryAccountDto[];
  defaultAccountId?: string | null;
  minDate?: string;
  destructive?: boolean;
  pending?: boolean;
  onClose: () => void;
  onConfirm: (values: ChequeActionValues) => void;
}

/** Mounted with the dialog content, so every opening starts from fresh values. */
function ChequeActionForm({
  title,
  description,
  accounts,
  defaultAccountId,
  minDate,
  destructive,
  pending,
  onClose,
  onConfirm,
}: ChequeActionProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(today());
  const [picked, setPicked] = useState('');
  const [note, setNote] = useState('');
  const fallback =
    defaultAccountId && accounts?.some((a) => a.id === defaultAccountId)
      ? defaultAccountId
      : accounts?.length === 1
        ? accounts[0].id
        : '';
  const accountId = picked || fallback;
  const ready = !!date && (!accounts || !!accountId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cheque-action-date">{t('finance.cheques.date')}</Label>
          <Input
            id="cheque-action-date"
            type="date"
            min={minDate}
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        {accounts && (
          <div className="space-y-2">
            <Label>{t('finance.cheques.account')}</Label>
            <AccountSelect value={accountId} onChange={setPicked} accounts={accounts} />
          </div>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cheque-action-note">{t('finance.cheques.note')}</Label>
          <Textarea
            id="cheque-action-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          variant={destructive ? 'destructive' : 'default'}
          disabled={!ready || pending}
          onClick={() =>
            onConfirm({
              date,
              accountId: accounts ? accountId : undefined,
              note: note.trim() || undefined,
            })
          }
        >
          {pending && <Loader2 className="animate-spin" />}
          {title}
        </Button>
      </DialogFooter>
    </>
  );
}

/** Date, account and note for a cheque lifecycle step. */
export function ChequeActionDialog({
  open,
  onOpenChange,
  ...props
}: Omit<ChequeActionProps, 'onClose'> & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ChequeActionForm {...props} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
