import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  payrollPeriodsFindAll,
  usePayrollPeriodsCreate,
  usePayrollPeriodsFindAll,
  usePayrollPeriodsSummary,
} from '@/api/generated/endpoints/payroll/payroll';
import type { PayrollPeriodDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import {
  CHART_COLORS,
  ChartSkeleton,
  KpiCard,
  PeriodChart,
} from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { PayrollStatusBadge, periodLabel, useInvalidatePayroll } from './payroll-components';

const thisMonth = () => new Date().toISOString().slice(0, 7);

export function PayrollPeriodsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState();
  const [creating, setCreating] = useState(false);
  const { data: summary } = usePayrollPeriodsSummary();
  const { data, isLoading } = usePayrollPeriodsFindAll(table.params, { query: tableQuery });
  const currency = summary?.currencyCode ?? 'TRY';

  const columns = useMemo<ColumnDef<PayrollPeriodDto, unknown>[]>(
    () => [
      {
        id: 'period',
        header: t('payroll.period'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{periodLabel(row.original)}</span>
            <code className="text-muted-foreground block text-xs">{row.original.number}</code>
          </span>
        ),
      },
      {
        id: 'employeeCount',
        header: t('payroll.employeeCount'),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.employeeCount}</span>,
      },
      {
        id: 'grossTotal',
        header: t('payroll.gross'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.grossTotal, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'netTotal',
        header: t('payroll.net'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatMoney(row.original.netTotal, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'employerCostTotal',
        header: t('payroll.employerCost'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.employerCostTotal, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'paymentDate',
        header: t('payroll.paymentDate'),
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.paymentDate),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (
          <PayrollStatusBadge status={row.original.status} imported={row.original.imported} />
        ),
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => payrollPeriodsFindAll({ page, pageSize: 100 }));
    await exportTable(
      format,
      'payroll',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('payroll.period'), value: (r) => periodLabel(r) },
        { header: t('payroll.employeeCount'), value: (r) => r.employeeCount },
        { header: t('payroll.gross'), value: (r) => Number(r.grossTotal) },
        { header: t('payroll.sgkTotal'), value: (r) => Number(r.sgkTotal) },
        { header: t('payroll.taxTotal'), value: (r) => Number(r.taxTotal) },
        { header: t('payroll.net'), value: (r) => Number(r.netTotal) },
        { header: t('payroll.employerCost'), value: (r) => Number(r.employerCostTotal) },
        {
          header: t('payroll.paymentDate'),
          value: (r) => (r.paymentDate ? new Date(r.paymentDate) : null),
        },
        { header: t('common.status'), value: (r) => t(`payroll.status.${r.status}`) },
      ],
      rows,
    );
  };

  const last = summary?.lastPeriod;
  return (
    <>
      <PageHeader
        title={t('payroll.title')}
        description={t('payroll.subtitle')}
        actions={
          <Can permission="payroll:create">
            <Button onClick={() => setCreating(true)} disabled={!!summary?.draftPeriod}>
              <Plus /> {t('payroll.new')}
            </Button>
          </Can>
        }
      />
      {summary && summary.missingSalaryCount > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          {t('payroll.messages.missingSalaries', { count: summary.missingSalaryCount })}
        </p>
      )}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('payroll.summary.lastNet')}
          value={summary && (last ? formatMoney(last.netTotal, currency) : '—')}
          hint={last && periodLabel(last)}
        />
        <KpiCard
          label={t('payroll.summary.toPay')}
          value={summary && formatMoney(summary.toPayAmount, currency)}
          tone={summary && Number(summary.toPayAmount) > 0 ? 'negative' : undefined}
        />
        <KpiCard
          label={t('payroll.summary.yearCost')}
          value={summary && formatMoney(summary.yearEmployerCostTotal, currency)}
          hint={
            summary &&
            t('payroll.summary.yearGross', {
              amount: formatMoney(summary.yearGrossTotal, currency),
            })
          }
        />
        <KpiCard
          label={t('payroll.summary.employees')}
          value={summary?.activeEmployeeCount}
          hint={
            summary?.draftPeriod &&
            t('payroll.summary.draft', { period: periodLabel(summary.draftPeriod) })
          }
        />
      </div>
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('payroll.summary.byMonth')}</CardTitle>
        </CardHeader>
        <CardContent>
          {summary ? (
            <PeriodChart
              height={240}
              currency={currency}
              data={summary.byMonth.map((m) => ({
                label: formatDate(`${m.year}-${String(m.month).padStart(2, '0')}-01`, 'MMM yyyy'),
                net: Number(m.netTotal),
                cost: Number(m.employerCostTotal),
              }))}
              series={[
                { key: 'net', label: t('payroll.net'), color: CHART_COLORS.primary },
                { key: 'cost', label: t('payroll.employerCost'), color: CHART_COLORS.secondary },
              ]}
            />
          ) : (
            <ChartSkeleton height={240} />
          )}
        </CardContent>
      </Card>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        searchable={false}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/payroll/$id', params: { id: row.id } })}
      />
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <NewPeriodForm
            onClose={() => setCreating(false)}
            onCreated={(id) => void navigate({ to: '/payroll/$id', params: { id } })}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Mounted with the dialog content, so every opening starts from the current month. */
function NewPeriodForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePayroll();
  const create = usePayrollPeriodsCreate();
  const [month, setMonth] = useState(thisMonth());
  const [year, monthNo] = month.split('-').map(Number);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('payroll.new')}</DialogTitle>
        <DialogDescription>{t('payroll.newHint')}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor="payroll-month">{t('payroll.period')}</Label>
        <Input
          id="payroll-month"
          type="month"
          max={thisMonth()}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          disabled={!year || !monthNo || create.isPending}
          onClick={() =>
            create.mutate(
              { data: { year, month: monthNo } },
              {
                onSuccess: async (period) => {
                  toast.success(t('payroll.messages.created'));
                  onClose();
                  await invalidate();
                  onCreated(period.id);
                },
              },
            )
          }
        >
          {create.isPending && <Loader2 className="animate-spin" />}
          {t('payroll.calculate')}
        </Button>
      </DialogFooter>
    </>
  );
}
