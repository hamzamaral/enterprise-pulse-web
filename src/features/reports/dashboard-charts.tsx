import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  useReportsCashFlowReport,
  useReportsPurchases,
  useReportsSales,
} from '@/api/generated/endpoints/reports/reports';
import { usePermission } from '@/features/auth/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { lastMonths } from './date-ranges';
import { CHART_COLORS, ChartSkeleton, monthLabel, PeriodChart } from './report-components';

const HEIGHT = 240;

/** Net sales and purchases of the last six months, side by side. */
export function TradeTrendCard() {
  const { t } = useTranslation();
  const can = usePermission();
  const range = lastMonths(6);
  const canSales = can('sales:read');
  const canPurchases = can('purchasing:read');
  const sales = useReportsSales(range, { query: { enabled: canSales } });
  const purchases = useReportsPurchases(range, { query: { enabled: canPurchases } });
  const ready = (!canSales || sales.data) && (!canPurchases || purchases.data);
  const base = sales.data ?? purchases.data;
  const purchaseByMonth = new Map(purchases.data?.rows.map((r) => [r.key, Number(r.netTotal)]));
  const data = (base?.rows ?? []).map((row) => ({
    label: monthLabel(row.key),
    sales: Number(sales.data?.rows.find((r) => r.key === row.key)?.netTotal ?? 0),
    purchases: purchaseByMonth.get(row.key) ?? 0,
  }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('reports.dashboard.trade')}</CardTitle>
        <Link
          to={canSales ? '/reports/sales' : '/reports/purchases'}
          className="text-primary text-sm hover:underline"
        >
          {t('reports.dashboard.details')}
        </Link>
      </CardHeader>
      <CardContent>
        {!ready || !base ? (
          <ChartSkeleton height={HEIGHT} />
        ) : (
          <PeriodChart
            height={HEIGHT}
            currency={base.currencyCode}
            data={data}
            series={[
              ...(canSales
                ? [
                    {
                      key: 'sales',
                      label: t('reports.dashboard.sales'),
                      color: CHART_COLORS.primary,
                    },
                  ]
                : []),
              ...(canPurchases
                ? [
                    {
                      key: 'purchases',
                      label: t('reports.dashboard.purchases'),
                      color: CHART_COLORS.secondary,
                    },
                  ]
                : []),
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

/** Cash and bank inflows / outflows of the last six months. */
export function CashFlowTrendCard() {
  const { t } = useTranslation();
  const { data } = useReportsCashFlowReport(lastMonths(6));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('reports.dashboard.cashFlow')}</CardTitle>
        <Link to="/reports/cash-flow" className="text-primary text-sm hover:underline">
          {t('reports.dashboard.details')}
        </Link>
      </CardHeader>
      <CardContent>
        {!data ? (
          <ChartSkeleton height={HEIGHT} />
        ) : (
          <PeriodChart
            height={HEIGHT}
            currency={data.currencyCode}
            data={data.months.map((m) => ({
              label: monthLabel(m.period),
              amountIn: Number(m.amountIn),
              amountOut: Number(m.amountOut),
            }))}
            series={[
              { key: 'amountIn', label: t('reports.cashFlow.in'), color: CHART_COLORS.secondary },
              { key: 'amountOut', label: t('reports.cashFlow.out'), color: CHART_COLORS.negative },
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}
