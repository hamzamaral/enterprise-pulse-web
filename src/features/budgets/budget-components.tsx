import { useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { BudgetDocumentType, BudgetItemState, BudgetStatus } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import i18n from '@/i18n';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

const STATE_TONES: Record<BudgetItemState, Tone> = {
  ON_TRACK: 'success',
  WARNING: 'warning',
  OVER: 'danger',
  BEHIND: 'warning',
};

export function BudgetStateBadge({ state }: { state: BudgetItemState }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATE_TONES[state]}>{t(`budgets.state.${state}`)}</ToneBadge>;
}

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={status === 'APPROVED' ? 'success' : 'neutral'}>
      {t(`budgets.status.${status}`)}
    </ToneBadge>
  );
}

/** "%92,3" / "92.3%" for a percentage value. */
export const formatPercent = (value: number | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
        style: 'percent',
        maximumFractionDigits: 1,
      }).format(value / 100);

/** Horizontal bar of `value` percent; amber above 90%, red above 100% (for expenses). */
export function UsageBar({
  value,
  income = false,
  className,
}: {
  value: number | null;
  income?: boolean;
  className?: string;
}) {
  if (value === null) return <span className="text-muted-foreground text-xs">—</span>;
  const tone = income
    ? value < 90
      ? 'bg-amber-500'
      : 'bg-emerald-500'
    : value > 110
      ? 'bg-red-500'
      : value > 100
        ? 'bg-amber-500'
        : 'bg-primary';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="bg-muted h-2 min-w-16 flex-1 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full', tone)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="w-14 text-right text-xs tabular-nums">{formatPercent(value)}</span>
    </div>
  );
}

/** This year, the previous one and the next one. */
export function budgetYears(): number[] {
  const year = new Date().getFullYear();
  return [year + 1, year, year - 1, year - 2];
}

/** "Oca", "Şub", … for months 1–12. */
export const monthShort = (month: number) =>
  formatDate(`2000-${String(month).padStart(2, '0')}-01`, 'MMM');

export function useInvalidateBudgets() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['budgets', 'budget-items', 'budget-entries'].some((path) =>
            key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}

/** Number of a source document, linked when the user may open it. */
export function DocumentLink({
  type,
  id,
  reference,
}: {
  type: BudgetDocumentType;
  id: string;
  reference: string | null;
}) {
  const { t } = useTranslation();
  const can = usePermission();
  const label = reference ?? t('budgets.manualEntry');
  const className = 'font-mono text-xs hover:underline';
  switch (type) {
    case 'EXPENSE_REPORT':
      return can('expenses:read') ? (
        <Link to="/expenses/$id" params={{ id }} className={className}>
          {label}
        </Link>
      ) : (
        <code className="text-xs">{label}</code>
      );
    case 'PAYROLL_PERIOD':
      return can('payroll:read') ? (
        <Link to="/payroll/$id" params={{ id }} className={className}>
          {label}
        </Link>
      ) : (
        <code className="text-xs">{label}</code>
      );
    case 'PURCHASE_INVOICE':
      return can('purchasing:read') ? (
        <Link to="/purchasing/invoices/$id" params={{ id }} className={className}>
          {label}
        </Link>
      ) : (
        <code className="text-xs">{label}</code>
      );
    case 'SALES_INVOICE':
      return can('sales:read') ? (
        <Link to="/sales/invoices/$id" params={{ id }} className={className}>
          {label}
        </Link>
      ) : (
        <code className="text-xs">{label}</code>
      );
    case 'SALES_RETURN':
      return can('sales:read') ? (
        <Link to="/sales/returns/$id" params={{ id }} className={className}>
          {label}
        </Link>
      ) : (
        <code className="text-xs">{label}</code>
      );
    default:
      return <span className="text-muted-foreground text-xs">{label}</span>;
  }
}
