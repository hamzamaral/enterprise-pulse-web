import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { PayrollPeriodStatus } from '@/api/generated/model';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';

const STATUS_TONES: Record<PayrollPeriodStatus, Tone> = {
  DRAFT: 'warning',
  APPROVED: 'info',
  PAID: 'success',
};

export function PayrollStatusBadge({
  status,
  imported,
}: {
  status: PayrollPeriodStatus;
  imported?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-wrap gap-1">
      <ToneBadge tone={STATUS_TONES[status]}>{t(`payroll.status.${status}`)}</ToneBadge>
      {imported && <ToneBadge tone="neutral">{t('payroll.imported')}</ToneBadge>}
    </span>
  );
}

/** "Eylül 2026" */
export const periodLabel = (period: { year: number; month: number }) =>
  formatDate(`${period.year}-${String(period.month).padStart(2, '0')}-01`, 'LLLL yyyy');

/** Payroll queries plus treasury balances, which change when salaries are paid. */
export function useInvalidatePayroll() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          (key.startsWith('/api/v1/payroll') ||
            key.startsWith('/api/v1/payslips') ||
            key.startsWith('/api/v1/salaries') ||
            key.startsWith('/api/v1/treasury-accounts') ||
            key.startsWith('/api/v1/finance-reports'))
        );
      },
    });
}

/** Amount row of a payslip; deductions and exemptions are shown with their sign. */
export function AmountRow({
  label,
  value,
  hint,
  strong,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? 'flex items-baseline justify-between gap-4 border-t pt-2 font-semibold'
          : 'flex items-baseline justify-between gap-4'
      }
    >
      <dt className={muted ? 'text-muted-foreground' : undefined}>
        {label}
        {hint && <span className="text-muted-foreground ml-1 text-xs font-normal">({hint})</span>}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
