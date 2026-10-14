import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccountingBalanceSheet } from '@/api/generated/endpoints/accounting/accounting';
import type { StatementClassDto } from '@/api/generated/model';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { type ExportFormat, exportTable } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';

interface StatementRow {
  side: string;
  level: number;
  code: string;
  name: string;
  amount: number;
}

const flatten = (side: string, classes: StatementClassDto[]): StatementRow[] =>
  classes.flatMap((c) => [
    { side, level: 0, code: c.code, name: c.name, amount: Number(c.total) },
    ...c.groups.flatMap((g) => [
      { side, level: 1, code: g.code, name: g.name, amount: Number(g.total) },
      ...g.accounts.map((a) => ({
        side,
        level: 2,
        code: a.code,
        name: a.name,
        amount: Number(a.amount),
      })),
    ]),
  ]);

/** Bilanço: assets against liabilities and equity on a date, including the period result. */
export function BalanceSheetPage({
  date,
  onDate,
}: {
  date: string;
  onDate: (date: string) => void;
}) {
  const { t } = useTranslation();
  const currency = useBaseCurrency();
  const { data, isLoading } = useAccountingBalanceSheet({ date });
  const title = t('accounting.balanceSheet.title');
  const balanced = data && data.totalAssets === data.totalLiabilities;

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    await exportTable<StatementRow>(
      format,
      `balance-sheet-${data.date}`,
      [
        { header: t('accounting.balanceSheet.side'), value: (r) => r.side },
        { header: t('accounting.accounts.code'), value: (r) => r.code },
        { header: t('accounting.accounts.name'), value: (r) => r.name },
        { header: t('accounting.amount'), value: (r) => r.amount },
      ],
      [
        ...flatten(t('accounting.balanceSheet.assets'), data.assets),
        ...flatten(t('accounting.balanceSheet.liabilities'), data.liabilities),
      ],
      `${title} · ${formatDate(data.date)}`,
    );
  };

  return (
    <>
      <PageHeader
        title={title}
        description={t('accounting.balanceSheet.subtitle')}
        actions={<ExportMenu onExport={handleExport} disabled={!data} />}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1">
            <Label htmlFor="balance-date">{t('accounting.balanceSheet.date')}</Label>
            <Input
              id="balance-date"
              type="date"
              className="w-44"
              value={date}
              onChange={(e) => e.target.value && onDate(e.target.value)}
            />
          </div>
          {data && (
            <span
              className={cn(
                'ml-auto flex h-9 items-center gap-1 text-sm',
                balanced ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {balanced ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              {balanced
                ? t('accounting.balanceSheet.balanced')
                : t('accounting.balanceSheet.unbalanced')}
            </span>
          )}
        </CardContent>
      </Card>
      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <StatementSide
            title={t('accounting.balanceSheet.assets')}
            classes={data.assets}
            total={data.totalAssets}
            currency={currency}
          />
          <StatementSide
            title={t('accounting.balanceSheet.liabilities')}
            classes={data.liabilities}
            total={data.totalLiabilities}
            currency={currency}
          />
        </div>
      )}
    </>
  );
}

function StatementSide({
  title,
  classes,
  total,
  currency,
}: {
  title: string;
  classes: StatementClassDto[];
  total: string;
  currency: string;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {classes.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('accounting.balanceSheet.empty')}</p>
        )}
        {classes.map((c) => (
          <div key={c.code}>
            <div className="flex justify-between gap-2 border-b pb-1 font-semibold">
              <span>
                {c.code}. {c.name}
              </span>
              <span className="tabular-nums">{formatMoney(c.total, currency)}</span>
            </div>
            {c.groups.map((g) => (
              <div key={g.code} className="mt-2">
                <div className="flex justify-between gap-2 text-sm font-medium">
                  <span>
                    <span className="font-mono">{g.code}</span> {g.name}
                  </span>
                  <span className="tabular-nums">{formatMoney(g.total, currency)}</span>
                </div>
                {g.accounts.map((a) => (
                  <div
                    key={a.code}
                    className="text-muted-foreground flex justify-between gap-2 pl-6 text-sm"
                  >
                    <span>
                      <span className="font-mono">{a.code}</span> {a.name}
                    </span>
                    <span className="tabular-nums">{formatMoney(a.amount, currency)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
        <div className="flex justify-between gap-2 border-t pt-2 text-base font-semibold">
          <span>{t('accounting.balanceSheet.total', { side: title })}</span>
          <span className="tabular-nums">{formatMoney(total, currency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
