import { useNavigate } from '@tanstack/react-router';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccountingTrialBalance } from '@/api/generated/endpoints/accounting/accounting';
import type { TrialBalanceRowDto } from '@/api/generated/model';
import type { DateRange } from '@/features/reports/date-ranges';
import { DateRangeFilter } from '@/features/reports/report-components';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { type ExportFormat, exportTable } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { AmountCell, levelIndent } from './accounting-components';

export interface TrialBalanceSearch extends DateRange {
  detailed?: boolean;
}

const AMOUNT_KEYS = [
  'periodDebit',
  'periodCredit',
  'totalDebit',
  'totalCredit',
  'balanceDebit',
  'balanceCredit',
] as const;

/** Mizan: period movements, cumulative totals and balances per account. */
export function TrialBalancePage({
  search,
  onSearch,
}: {
  search: TrialBalanceSearch;
  onSearch: (patch: Partial<TrialBalanceSearch>) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currency = useBaseCurrency();
  const { data, isLoading } = useAccountingTrialBalance({
    from: search.from,
    to: search.to,
    detailed: search.detailed || undefined,
  });
  const title = t('accounting.trialBalance.title');
  const balanced =
    data &&
    data.totals.totalDebit === data.totals.totalCredit &&
    data.totals.balanceDebit === data.totals.balanceCredit;
  const headers: Record<(typeof AMOUNT_KEYS)[number], string> = {
    periodDebit: t('accounting.trialBalance.periodDebit'),
    periodCredit: t('accounting.trialBalance.periodCredit'),
    totalDebit: t('accounting.trialBalance.totalDebit'),
    totalCredit: t('accounting.trialBalance.totalCredit'),
    balanceDebit: t('accounting.trialBalance.balanceDebit'),
    balanceCredit: t('accounting.trialBalance.balanceCredit'),
  };

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    await exportTable<TrialBalanceRowDto>(
      format,
      `trial-balance-${data.from}-${data.to}`,
      [
        { header: t('accounting.accounts.code'), value: (r) => r.code },
        { header: t('accounting.accounts.name'), value: (r) => r.name },
        ...AMOUNT_KEYS.map((key) => ({
          header: headers[key],
          value: (r: TrialBalanceRowDto) => Number(r[key]),
        })),
      ],
      data.rows,
      `${title} · ${formatDate(data.from)} – ${formatDate(data.to)}`,
    );
  };

  return (
    <>
      <PageHeader
        title={title}
        description={t('accounting.trialBalance.subtitle')}
        actions={<ExportMenu onExport={handleExport} disabled={!data} />}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <DateRangeFilter
            value={{ from: search.from, to: search.to }}
            onChange={(range) => onSearch(range)}
          />
          <div className="flex h-9 items-center gap-2">
            <Switch
              id="trial-detailed"
              checked={!!search.detailed}
              onCheckedChange={(checked) => onSearch({ detailed: checked || undefined })}
            />
            <Label htmlFor="trial-detailed">{t('accounting.trialBalance.detailed')}</Label>
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
                ? t('accounting.trialBalance.balanced')
                : t('accounting.trialBalance.unbalanced')}
            </span>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          {isLoading || !data ? (
            <Skeleton className="h-96" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('accounting.accounts.code')}</TableHead>
                  <TableHead>{t('accounting.accounts.name')}</TableHead>
                  {AMOUNT_KEYS.map((key) => (
                    <TableHead key={key} className="text-right">
                      {headers[key]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground py-8 text-center">
                      {t('accounting.trialBalance.empty')}
                    </TableCell>
                  </TableRow>
                )}
                {data.rows.map((row) => (
                  <TableRow
                    key={row.code}
                    className={cn(row.accountId && 'cursor-pointer')}
                    onClick={() =>
                      row.accountId &&
                      void navigate({
                        to: '/accounting/accounts/$id',
                        params: { id: row.accountId },
                        search: { from: data.from, to: data.to },
                      })
                    }
                  >
                    <TableCell className="font-mono text-sm whitespace-nowrap">
                      <span style={levelIndent(row.level)}>{row.code}</span>
                    </TableCell>
                    <TableCell className={cn('text-sm', row.level === 0 && 'font-medium')}>
                      {row.name}
                    </TableCell>
                    {AMOUNT_KEYS.map((key) => (
                      <TableCell key={key} className="text-right">
                        <AmountCell value={row[key]} currency={currency} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-medium">
                    {t('accounting.total')}
                  </TableCell>
                  {AMOUNT_KEYS.map((key) => (
                    <TableCell key={key} className="text-right">
                      <AmountCell value={data.totals[key]} currency={currency} strong />
                    </TableCell>
                  ))}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
