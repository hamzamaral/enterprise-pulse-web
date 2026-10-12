import { useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { expenseReportsReceiptUrl } from '@/api/generated/endpoints/expenses/expenses';
import type { ExpenseCategoryKind, ExpenseReportStatus } from '@/api/generated/model';
import { getErrorMessage } from '@/api/http';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';

const STATUS_TONES: Record<ExpenseReportStatus, Tone> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  APPROVED: 'info',
  REJECTED: 'danger',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export function ExpenseStatusBadge({ status }: { status: ExpenseReportStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`expenses.status.${status}`)}</ToneBadge>;
}

/** Per diem and mileage lines are priced by the category rate instead of a receipt. */
export const isRated = (kind: ExpenseCategoryKind) => kind !== 'RECEIPT';

/** Expense queries plus treasury balances, which change when a report is paid. */
export function useInvalidateExpenses() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          (key.startsWith('/api/v1/expense') ||
            key.startsWith('/api/v1/treasury-accounts') ||
            key.startsWith('/api/v1/finance-reports') ||
            key.startsWith('/api/v1/workflow'))
        );
      },
    });
}

/** Opens the signed receipt URL; the tab is opened first so popup blockers allow it. */
export function ReceiptButton({
  reportId,
  lineId,
  name,
}: {
  reportId: string;
  lineId: string;
  name: string | null;
}) {
  const { t } = useTranslation();
  const open = async () => {
    const tab = window.open('', '_blank');
    try {
      const { url } = await expenseReportsReceiptUrl(reportId, lineId);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (error) {
      tab?.close();
      toast.error(getErrorMessage(error));
    }
  };
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 max-w-44 px-2"
      title={t('expenses.actions.downloadReceipt')}
      onClick={() => void open()}
    >
      <Paperclip />
      <span className="truncate">{name ?? t('expenses.lines.receipt')}</span>
    </Button>
  );
}
