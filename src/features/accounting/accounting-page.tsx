import { Link } from '@tanstack/react-router';
import {
  BookOpen,
  CalendarX2,
  FileSpreadsheet,
  ListTree,
  Loader2,
  Lock,
  Plus,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useAccountingPending,
  useAccountingRun,
  useAccountingSummary,
  useAccountingUpdateSettings,
  useLedgerAccountsInstall,
} from '@/api/generated/endpoints/accounting/accounting';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import {
  CHART_COLORS,
  ChartSkeleton,
  KpiCard,
  PeriodChart,
} from '@/features/reports/report-components';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { PostingActionBadge, useInvalidateAccounting } from './accounting-components';

const PENDING_PREVIEW = 8;

const lockSchema = z.object({ lockedUntil: z.string() });

const monthName = (month: number) => formatDate(`2000-${String(month).padStart(2, '0')}-01`, 'MMM');

/** Accounting overview: key balances, monthly result, documents waiting to be posted. */
export function AccountingPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [lockOpen, setLockOpen] = useState(false);
  const { data: summary } = useAccountingSummary({ year });
  const { data: pending, isLoading: pendingLoading } = useAccountingPending();
  const invalidate = useInvalidateAccounting();
  const run = useAccountingRun();
  const install = useLedgerAccountsInstall();
  const updateSettings = useAccountingUpdateSettings();
  const currency = summary?.currencyCode ?? 'TRY';
  const money = (value: string | undefined) =>
    value === undefined ? undefined : formatMoney(value, currency);
  const profit = Number(summary?.netProfit ?? 0);
  const chart = (summary?.months ?? []).map((m) => ({
    label: monthName(m.month),
    revenue: Number(m.revenue),
    expense: Number(m.expense),
    profit: Number(m.profit),
  }));

  const runNow = () =>
    run.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('accounting.runDone', { ...result }));
        await invalidate();
      },
    });

  const installChart = () =>
    install.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('accounting.accounts.installed', { count: result.created }));
        await invalidate();
      },
    });

  if (summary && !summary.chartInstalled) {
    return (
      <>
        <PageHeader title={t('accounting.title')} description={t('accounting.subtitle')} />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ListTree className="text-muted-foreground size-10" />
            <p className="font-medium">{t('accounting.noChart')}</p>
            <p className="text-muted-foreground max-w-md text-sm">{t('accounting.noChartHint')}</p>
            <Can permission="accounting:update">
              <Button onClick={installChart} disabled={install.isPending}>
                {install.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {t('accounting.accounts.install')}
              </Button>
            </Can>
          </CardContent>
        </Card>
      </>
    );
  }

  const pendingRows = pending ?? [];
  const lockedCount = pendingRows.filter((p) => p.locked).length;

  return (
    <>
      <PageHeader
        title={t('accounting.title')}
        description={t('accounting.subtitle')}
        actions={
          <>
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-28" aria-label={t('accounting.year')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Can permission="accounting:close">
              <Button variant="outline" onClick={() => setLockOpen(true)}>
                <Lock /> {t('accounting.lock.action')}
              </Button>
            </Can>
            <Can permission="accounting:update">
              <Button asChild>
                <Link to="/accounting/journal/new">
                  <Plus /> {t('accounting.journal.new')}
                </Link>
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('accounting.kpi.cash')}
          value={money(summary?.cash)}
          hint={t('accounting.kpi.cashHint')}
        />
        <KpiCard
          label={t('accounting.kpi.receivables')}
          value={money(summary?.receivables)}
          hint={t('accounting.kpi.receivablesHint')}
        />
        <KpiCard
          label={t('accounting.kpi.payables')}
          value={money(summary?.payables)}
          hint={t('accounting.kpi.payablesHint')}
        />
        <KpiCard
          label={t('accounting.kpi.netProfit', { year })}
          value={money(summary?.netProfit)}
          tone={profit > 0 ? 'positive' : profit < 0 ? 'negative' : undefined}
          hint={
            summary &&
            t('accounting.kpi.netSales', { value: formatMoney(summary.netSales, currency) })
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('accounting.monthlyTitle', { year })}</CardTitle>
          </CardHeader>
          <CardContent>
            {summary ? (
              <PeriodChart
                data={chart}
                currency={currency}
                series={[
                  { key: 'revenue', label: t('accounting.revenue'), color: CHART_COLORS.primary },
                  { key: 'expense', label: t('accounting.expense'), color: CHART_COLORS.negative },
                  {
                    key: 'profit',
                    label: t('accounting.profit'),
                    color: CHART_COLORS.secondary,
                    line: true,
                  },
                ]}
              />
            ) : (
              <ChartSkeleton />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('accounting.shortcuts')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {(
              [
                ['/accounting/journal', BookOpen, 'accounting.journal.title'],
                ['/accounting/accounts', ListTree, 'accounting.accounts.title'],
                ['/accounting/trial-balance', FileSpreadsheet, 'accounting.trialBalance.title'],
                ['/accounting/balance-sheet', Scale, 'accounting.balanceSheet.title'],
                ['/accounting/income-statement', TrendingUp, 'accounting.incomeStatement.title'],
              ] as const
            ).map(([to, Icon, label]) => (
              <Button key={to} variant="outline" className="justify-start" asChild>
                <Link to={to}>
                  <Icon /> {t(label)}
                </Link>
              </Button>
            ))}
            <dl className="text-muted-foreground mt-2 grid gap-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt>{t('accounting.entryCount')}</dt>
                <dd className="text-foreground tabular-nums">
                  {summary ? summary.entryCount : <Skeleton className="h-4 w-10" />}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t('accounting.lock.label')}</dt>
                <dd className="text-foreground">
                  {summary?.lockedUntil
                    ? formatDate(summary.lockedUntil)
                    : t('accounting.lock.none')}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">
              {t('accounting.pending.title')}
              {pendingRows.length > 0 && (
                <span className="text-muted-foreground ml-2 font-normal">
                  ({pendingRows.length})
                </span>
              )}
            </CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">{t('accounting.pending.hint')}</p>
          </div>
          {can('accounting:approve') && (
            <Button onClick={runNow} disabled={run.isPending || pendingRows.length === lockedCount}>
              {run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {t('accounting.pending.run')}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <Skeleton className="h-32" />
          ) : pendingRows.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {t('accounting.pending.empty')}
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounting.date')}</TableHead>
                    <TableHead>{t('accounting.sourceLabel')}</TableHead>
                    <TableHead>{t('accounting.document')}</TableHead>
                    <TableHead>{t('accounting.description')}</TableHead>
                    <TableHead className="text-right">{t('accounting.amount')}</TableHead>
                    <TableHead>{t('accounting.pending.action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRows.slice(0, PENDING_PREVIEW).map((row) => (
                    <TableRow key={`${row.source}:${row.sourceId}`}>
                      <TableCell className="whitespace-nowrap">{formatDate(row.date)}</TableCell>
                      <TableCell className="text-sm">
                        {t(`accounting.source.${row.source}`)}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{row.sourceNumber}</code>
                      </TableCell>
                      <TableCell className="max-w-72 truncate text-sm">{row.description}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.amount, currency)}
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap gap-1">
                          <PostingActionBadge action={row.action} />
                          {row.locked && (
                            <ToneBadge tone="neutral">
                              <CalendarX2 className="size-3" /> {t('accounting.pending.locked')}
                            </ToneBadge>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {pendingRows.length > PENDING_PREVIEW && (
                <p className="text-muted-foreground mt-2 text-sm">
                  {t('accounting.pending.more', { count: pendingRows.length - PENDING_PREVIEW })}
                </p>
              )}
              {lockedCount > 0 && (
                <p className="text-muted-foreground mt-2 text-sm">
                  {t('accounting.pending.lockedHint', { count: lockedCount })}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <SimpleFormDialog
        open={lockOpen}
        onOpenChange={setLockOpen}
        title={t('accounting.lock.title')}
        description={<p className="text-muted-foreground text-sm">{t('accounting.lock.hint')}</p>}
        schema={lockSchema}
        fields={[{ name: 'lockedUntil', label: t('accounting.lock.label'), type: 'date' }]}
        defaultValues={{ lockedUntil: summary?.lockedUntil?.slice(0, 10) ?? '' }}
        pending={updateSettings.isPending}
        onSubmit={(values) =>
          updateSettings.mutate(
            { data: { lockedUntil: values.lockedUntil || null } },
            {
              onSuccess: async (saved) => {
                toast.success(
                  saved.lockedUntil
                    ? t('accounting.lock.saved', { date: formatDate(saved.lockedUntil) })
                    : t('accounting.lock.cleared'),
                );
                setLockOpen(false);
                await invalidate();
              },
            },
          )
        }
      />
    </>
  );
}
