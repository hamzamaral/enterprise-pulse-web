import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type {
  JournalEntryStatus,
  JournalSource,
  LedgerAccountType,
  PostingAction,
} from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const ACTION_TONES: Record<PostingAction, Tone> = {
  POST: 'info',
  REVERSE: 'danger',
  REPOST: 'warning',
};

const TYPE_TONES: Record<LedgerAccountType, Tone> = {
  ASSET: 'info',
  LIABILITY: 'warning',
  EQUITY: 'neutral',
  INCOME: 'success',
  EXPENSE: 'danger',
};

export function JournalStatusBadge({
  status,
  reversed,
  reversal,
}: {
  status: JournalEntryStatus;
  reversed?: boolean;
  reversal?: boolean;
}) {
  const { t } = useTranslation();
  if (status === 'DRAFT')
    return <ToneBadge tone="neutral">{t('accounting.status.DRAFT')}</ToneBadge>;
  if (reversed) return <ToneBadge tone="danger">{t('accounting.status.REVERSED')}</ToneBadge>;
  if (reversal) return <ToneBadge tone="warning">{t('accounting.status.REVERSAL')}</ToneBadge>;
  return <ToneBadge tone="success">{t('accounting.status.POSTED')}</ToneBadge>;
}

export function PostingActionBadge({ action }: { action: PostingAction }) {
  const { t } = useTranslation();
  return <ToneBadge tone={ACTION_TONES[action]}>{t(`accounting.action.${action}`)}</ToneBadge>;
}

export function AccountTypeBadge({ type }: { type: LedgerAccountType }) {
  const { t } = useTranslation();
  return <ToneBadge tone={TYPE_TONES[type]}>{t(`accounting.type.${type}`)}</ToneBadge>;
}

/** Amount column cell: blank for zero so debit / credit columns stay readable. */
export function AmountCell({
  value,
  currency,
  strong,
}: {
  value: string | number;
  currency?: string;
  strong?: boolean;
}) {
  const amount = Number(value);
  return (
    <span className={cn('whitespace-nowrap tabular-nums', strong && 'font-semibold')}>
      {amount ? formatMoney(amount, currency) : ''}
    </span>
  );
}

/** Signed balance as "1.250,00 B" (borç) or "300,00 A" (alacak). */
export function BalanceCell({ value, currency }: { value: string | number; currency?: string }) {
  const { t } = useTranslation();
  const amount = Number(value);
  if (!amount) return <span className="text-muted-foreground tabular-nums">—</span>;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatMoney(Math.abs(amount), currency)}{' '}
      <span className="text-muted-foreground text-xs">
        {amount > 0 ? t('accounting.debitShort') : t('accounting.creditShort')}
      </span>
    </span>
  );
}

type DocumentTarget =
  | '/sales/invoices/$id'
  | '/sales/returns/$id'
  | '/sales/deliveries/$id'
  | '/purchasing/invoices/$id'
  | '/inventory/movements/$id'
  | '/finance/collections/$id'
  | '/finance/payments/$id'
  | '/finance/cheques/$id'
  | '/finance/accounts/$id'
  | '/partners/$id'
  | '/expenses/$id'
  | '/payroll/$id'
  | '/production/work-orders/$id';

const DOCUMENT_TARGETS: Record<JournalSource, { to: DocumentTarget; permission: string } | null> = {
  MANUAL: null,
  TREASURY_OPENING: { to: '/finance/accounts/$id', permission: 'finance:read' },
  PARTNER_OPENING: { to: '/partners/$id', permission: 'partners:read' },
  SALES_INVOICE: { to: '/sales/invoices/$id', permission: 'sales:read' },
  SALES_RETURN: { to: '/sales/returns/$id', permission: 'sales:read' },
  PURCHASE_INVOICE: { to: '/purchasing/invoices/$id', permission: 'purchasing:read' },
  DELIVERY_NOTE: { to: '/sales/deliveries/$id', permission: 'sales:read' },
  STOCK_MOVEMENT: { to: '/inventory/movements/$id', permission: 'inventory:read' },
  COLLECTION: { to: '/finance/collections/$id', permission: 'finance:read' },
  PAYMENT: { to: '/finance/payments/$id', permission: 'finance:read' },
  CHEQUE: { to: '/finance/cheques/$id', permission: 'finance:read' },
  EXPENSE_REPORT: { to: '/expenses/$id', permission: 'expenses:read' },
  EXPENSE_PAYMENT: { to: '/expenses/$id', permission: 'expenses:read' },
  PAYROLL: { to: '/payroll/$id', permission: 'payroll:read' },
  PAYROLL_PAYMENT: { to: '/payroll/$id', permission: 'payroll:read' },
  PRODUCTION: { to: '/production/work-orders/$id', permission: 'production:read' },
};

const DIRECT_SOURCES = new Set<JournalSource>([
  'SALES_INVOICE',
  'SALES_RETURN',
  'PURCHASE_INVOICE',
  'DELIVERY_NOTE',
  'STOCK_MOVEMENT',
  'COLLECTION',
  'PAYMENT',
  'EXPENSE_REPORT',
  'PAYROLL',
]);

/** The source id is the document id except for treasury movements and partner openings. */
export const directDocumentId = (source: JournalSource, sourceId: string | null) =>
  DIRECT_SOURCES.has(source) ? sourceId : null;

/** Source document number, linked when the record can be opened by the user. */
export function SourceDocumentLink({
  source,
  documentId,
  number,
}: {
  source: JournalSource;
  documentId: string | null;
  number: string | null;
}) {
  const can = usePermission();
  if (!number) return <span className="text-muted-foreground">—</span>;
  const target = DOCUMENT_TARGETS[source];
  if (!target || !documentId || !can(target.permission)) {
    return <code className="text-xs">{number}</code>;
  }
  return (
    <Link
      to={target.to}
      params={{ id: documentId }}
      className="font-mono text-xs hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {number}
    </Link>
  );
}

/** Indentation of sub-accounts ("120.01") in account lists. */
export const levelIndent = (level: number) => ({ paddingLeft: `${level * 1.25}rem` });

export function useInvalidateAccounting() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['accounting', 'ledger-accounts', 'journal-entries'].some((path) =>
            key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}
