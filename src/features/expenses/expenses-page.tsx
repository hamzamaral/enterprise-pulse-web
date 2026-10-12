import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useExpenseReportsSummary } from '@/api/generated/endpoints/expenses/expenses';
import {
  CHART_COLORS,
  ChartSkeleton,
  KpiCard,
  PeriodChart,
  RankingChart,
  monthLabel,
} from '@/features/reports/report-components';
import { PageHeader } from '@/shared/components/page-header';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { ExpenseReportsTable } from './expense-reports-table';

export function ExpensesPage() {
  const { t } = useTranslation();
  const { data: summary } = useExpenseReportsSummary();
  const currency = summary?.currencyCode ?? 'TRY';

  return (
    <>
      <PageHeader
        title={t('expenses.title')}
        description={t('expenses.subtitle')}
        actions={
          <Button asChild>
            <Link to="/expenses/new">
              <Plus /> {t('expenses.new')}
            </Link>
          </Button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={t('expenses.summary.pending')}
          value={summary && formatMoney(summary.pendingAmount, currency)}
          hint={summary && t('expenses.summary.count', { count: summary.pendingCount })}
        />
        <KpiCard
          label={t('expenses.summary.toPay')}
          value={summary && formatMoney(summary.toPayAmount, currency)}
          hint={summary && t('expenses.summary.count', { count: summary.toPayCount })}
          tone={summary && Number(summary.toPayAmount) > 0 ? 'negative' : undefined}
        />
        <KpiCard
          label={t('expenses.summary.paidThisMonth')}
          value={summary && formatMoney(summary.paidThisMonthAmount, currency)}
        />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('expenses.summary.byMonth')}</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <PeriodChart
                height={240}
                currency={currency}
                data={summary.byMonth.map((m) => ({
                  label: monthLabel(m.month),
                  amount: Number(m.amount),
                }))}
                series={[
                  {
                    key: 'amount',
                    label: t('expenses.summary.amount'),
                    color: CHART_COLORS.primary,
                  },
                ]}
              />
            ) : (
              <ChartSkeleton height={240} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('expenses.summary.byCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <RankingChart
                currency={currency}
                label={t('expenses.summary.amount')}
                data={summary.byCategory.map((c) => ({ label: c.name, value: Number(c.amount) }))}
              />
            ) : (
              <ChartSkeleton height={240} />
            )}
          </CardContent>
        </Card>
      </div>
      <ExpenseReportsTable />
    </>
  );
}
