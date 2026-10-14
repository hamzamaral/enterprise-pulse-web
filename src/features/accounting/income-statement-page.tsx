import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccountingIncomeStatement } from '@/api/generated/endpoints/accounting/accounting';
import type { IncomeSectionKey, IncomeStatementDto } from '@/api/generated/model';
import type { DateRange } from '@/features/reports/date-ranges';
import { DateRangeFilter, KpiCard } from '@/features/reports/report-components';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { type ExportFormat, exportTable } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

type Subtotal = Exclude<keyof IncomeStatementDto, 'from' | 'to' | 'sections'>;

/** Result line printed after a section, following the Tekdüzen layout. */
const SUBTOTAL_AFTER: Partial<Record<IncomeSectionKey, Subtotal>> = {
  salesDeductions: 'netSales',
  costOfSales: 'grossProfit',
  operatingExpenses: 'operatingProfit',
  financeExpenses: 'ordinaryProfit',
  extraordinaryExpenses: 'profitBeforeTax',
  taxProvision: 'netProfit',
};

interface ExportRow {
  code: string;
  name: string;
  amount: number;
}

/** Gelir tablosu for a period. */
export function IncomeStatementPage({
  search,
  onSearch,
}: {
  search: DateRange;
  onSearch: (range: DateRange) => void;
}) {
  const { t } = useTranslation();
  const currency = useBaseCurrency();
  const { data, isLoading } = useAccountingIncomeStatement({ from: search.from, to: search.to });
  const title = t('accounting.incomeStatement.title');
  const money = (value: string | number) => formatMoney(value, currency);
  const tone = (value: string) =>
    Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : undefined;

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    const rows: ExportRow[] = data.sections.flatMap((section) => {
      const subtotal = SUBTOTAL_AFTER[section.key];
      return [
        {
          code: '',
          name: t(`accounting.incomeStatement.sections.${section.key}`),
          amount: Number(section.total),
        },
        ...section.accounts.map((a) => ({ code: a.code, name: a.name, amount: Number(a.amount) })),
        ...(subtotal
          ? [
              {
                code: '',
                name: t(`accounting.incomeStatement.subtotals.${subtotal}`),
                amount: Number(data[subtotal]),
              },
            ]
          : []),
      ];
    });
    await exportTable<ExportRow>(
      format,
      `income-statement-${data.from}-${data.to}`,
      [
        { header: t('accounting.accounts.code'), value: (r) => r.code },
        { header: t('accounting.accounts.name'), value: (r) => r.name },
        { header: t('accounting.amount'), value: (r) => r.amount },
      ],
      rows,
      `${title} · ${formatDate(data.from)} – ${formatDate(data.to)}`,
    );
  };

  return (
    <>
      <PageHeader
        title={title}
        description={t('accounting.incomeStatement.subtitle')}
        actions={<ExportMenu onExport={handleExport} disabled={!data} />}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <DateRangeFilter value={search} onChange={onSearch} />
        </CardContent>
      </Card>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('accounting.incomeStatement.subtotals.netSales')}
          value={data && money(data.netSales)}
        />
        <KpiCard
          label={t('accounting.incomeStatement.subtotals.grossProfit')}
          value={data && money(data.grossProfit)}
          tone={data && tone(data.grossProfit)}
        />
        <KpiCard
          label={t('accounting.incomeStatement.subtotals.operatingProfit')}
          value={data && money(data.operatingProfit)}
          tone={data && tone(data.operatingProfit)}
        />
        <KpiCard
          label={t('accounting.incomeStatement.subtotals.netProfit')}
          value={data && money(data.netProfit)}
          tone={data && tone(data.netProfit)}
        />
      </div>
      <Card>
        <CardContent className="pt-6">
          {isLoading || !data ? (
            <Skeleton className="h-96" />
          ) : (
            <div className="space-y-1">
              {data.sections.map((section) => {
                const subtotal = SUBTOTAL_AFTER[section.key];
                return (
                  <Fragment key={section.key}>
                    <div className="flex justify-between gap-2 pt-2 font-medium">
                      <span>{t(`accounting.incomeStatement.sections.${section.key}`)}</span>
                      <span className="tabular-nums">{money(section.total)}</span>
                    </div>
                    {section.accounts.map((a) => (
                      <div
                        key={a.code}
                        className="text-muted-foreground flex justify-between gap-2 pl-6 text-sm"
                      >
                        <span>
                          <span className="font-mono">{a.code}</span> {a.name}
                        </span>
                        <span className="tabular-nums">{money(a.amount)}</span>
                      </div>
                    ))}
                    {subtotal && (
                      <div
                        className={cn(
                          'bg-muted/50 flex justify-between gap-2 rounded-md px-2 py-1.5 font-semibold',
                          subtotal === 'netProfit' && 'text-base',
                          Number(data[subtotal]) < 0 && 'text-destructive',
                        )}
                      >
                        <span>{t(`accounting.incomeStatement.subtotals.${subtotal}`)}</span>
                        <span className="tabular-nums">{money(data[subtotal])}</span>
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
