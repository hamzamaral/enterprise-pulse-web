import { useTranslation } from 'react-i18next';
import { useTreasuryAccountsFindAll } from '@/api/generated/endpoints/finance/finance';
import { useReportsCashFlowReport } from '@/api/generated/endpoints/reports/reports';
import type { CashFlowMonthDto } from '@/api/generated/model';
import { accountLabel } from '@/features/finance/finance-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { type ExportFormat, exportTable } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import type { DateRange } from './date-ranges';
import {
  CHART_COLORS,
  ChartSkeleton,
  DateRangeFilter,
  KpiCard,
  monthLabel,
  PeriodChart,
} from './report-components';

export interface CashFlowSearch extends DateRange {
  accountId?: string;
}

const ALL = 'all';

/** Monthly cash and bank inflows / outflows with opening and closing balances. */
export function CashFlowPage({
  search,
  onSearch,
}: {
  search: CashFlowSearch;
  onSearch: (patch: Partial<CashFlowSearch>) => void;
}) {
  const { t } = useTranslation();
  const { data: accounts } = useTreasuryAccountsFindAll({});
  const { data, isLoading } = useReportsCashFlowReport({
    from: search.from,
    to: search.to,
    accountId: search.accountId,
  });
  const currency = data?.currencyCode ?? 'TRY';
  const money = (value: string) => formatMoney(value, currency);
  const title = t('reports.cashFlow.title');

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    await exportTable<CashFlowMonthDto>(
      format,
      `cash-flow-${search.from}-${search.to}`,
      [
        { header: t('reports.columns.MONTH'), value: (r) => monthLabel(r.period) },
        { header: t('reports.cashFlow.in'), value: (r) => Number(r.amountIn) },
        { header: t('reports.cashFlow.out'), value: (r) => Number(r.amountOut) },
        { header: t('reports.cashFlow.net'), value: (r) => Number(r.net) },
      ],
      data.months,
      `${title} · ${formatDate(search.from)} – ${formatDate(search.to)}`,
    );
  };

  return (
    <>
      <PageHeader
        title={title}
        description={t('reports.cashFlow.subtitle')}
        actions={<ExportMenu onExport={handleExport} disabled={!data} />}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <DateRangeFilter
            value={{ from: search.from, to: search.to }}
            onChange={(range) => onSearch(range)}
          />
          <div className="space-y-1">
            <Label>{t('reports.cashFlow.account')}</Label>
            <Select
              value={search.accountId ?? ALL}
              onValueChange={(value) => onSearch({ accountId: value === ALL ? undefined : value })}
            >
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('reports.cashFlow.allAccounts')}</SelectItem>
                {(accounts ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={t('reports.cashFlow.opening')} value={data && money(data.opening)} />
        <KpiCard
          label={t('reports.cashFlow.in')}
          value={data && money(data.amountIn)}
          tone="positive"
        />
        <KpiCard
          label={t('reports.cashFlow.out')}
          value={data && money(data.amountOut)}
          tone="negative"
        />
        <KpiCard
          label={t('reports.cashFlow.closing')}
          value={data && money(data.closing)}
          hint={data && `${t('reports.cashFlow.net')}: ${money(data.net)}`}
        />
      </div>
      {!search.accountId && (
        <p className="text-muted-foreground mb-4 text-xs">
          {t('reports.cashFlow.rateNote')}
          {data?.unconvertedCurrencies.length
            ? ` ${t('reports.cashFlow.unconverted', { currencies: data.unconvertedCurrencies.join(', ') })}`
            : ''}
        </p>
      )}

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('reports.trend')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <ChartSkeleton />
          ) : (
            <PeriodChart
              currency={currency}
              data={data.months.map((m) => ({
                label: monthLabel(m.period),
                amountIn: Number(m.amountIn),
                amountOut: Number(m.amountOut),
                net: Number(m.net),
              }))}
              series={[
                { key: 'amountIn', label: t('reports.cashFlow.in'), color: CHART_COLORS.secondary },
                {
                  key: 'amountOut',
                  label: t('reports.cashFlow.out'),
                  color: CHART_COLORS.negative,
                },
                {
                  key: 'net',
                  label: t('reports.cashFlow.net'),
                  color: CHART_COLORS.primary,
                  line: true,
                },
              ]}
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('reports.cashFlow.months')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-48" />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('reports.columns.MONTH')}</TableHead>
                      <TableHead className="text-right">{t('reports.cashFlow.in')}</TableHead>
                      <TableHead className="text-right">{t('reports.cashFlow.out')}</TableHead>
                      <TableHead className="text-right">{t('reports.cashFlow.net')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.months.map((m) => (
                      <TableRow key={m.period}>
                        <TableCell className="font-medium">{monthLabel(m.period)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(m.amountIn)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {money(m.amountOut)}
                        </TableCell>
                        <TableCell
                          className={
                            Number(m.net) < 0
                              ? 'text-destructive text-right tabular-nums'
                              : 'text-right tabular-nums'
                          }
                        >
                          {money(m.net)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/40 hover:bg-muted/40 font-medium">
                      <TableCell>{t('reports.totals')}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(data.amountIn)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(data.amountOut)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{money(data.net)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('reports.cashFlow.byType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-48" />
            ) : data.byType.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.cashFlow.documentType')}</TableHead>
                    <TableHead className="text-right">{t('reports.cashFlow.in')}</TableHead>
                    <TableHead className="text-right">{t('reports.cashFlow.out')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byType.map((row) => (
                    <TableRow key={row.documentType}>
                      <TableCell>{t(`finance.treasuryDocs.${row.documentType}`)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(row.amountIn) ? money(row.amountIn) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(row.amountOut) ? money(row.amountOut) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">{t('reports.empty')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
