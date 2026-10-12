import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useExpenseReportsSummary } from '@/api/generated/endpoints/expenses/expenses';
import { useMe, usePermission } from '@/features/auth/use-session';
import { KpiCard } from '@/features/reports/report-components';
import { PageHeader } from '@/shared/components/page-header';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { ExpenseReportsTable } from './expense-reports-table';

export function MyExpensesPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const can = usePermission();
  const { data: summary } = useExpenseReportsSummary();
  const canFile = !!me?.employeeId || can('expenses:create');
  return (
    <>
      <PageHeader
        title={t('expenses.myTitle')}
        description={t('expenses.mySubtitle')}
        actions={
          canFile && (
            <Button asChild>
              <Link to="/expenses/new">
                <Plus /> {t('expenses.new')}
              </Link>
            </Button>
          )
        }
      />
      {me && !canFile && (
        <p className="text-muted-foreground mb-4 text-sm">{t('expenses.messages.noEmployee')}</p>
      )}
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <KpiCard label={t('expenses.summary.myDrafts')} value={summary?.myDraftCount} />
        <KpiCard label={t('expenses.summary.myPending')} value={summary?.myPendingCount} />
        <KpiCard
          label={t('expenses.summary.myToPay')}
          value={summary && formatMoney(summary.myToPayAmount, summary.currencyCode)}
        />
      </div>
      <ExpenseReportsTable mine />
    </>
  );
}
