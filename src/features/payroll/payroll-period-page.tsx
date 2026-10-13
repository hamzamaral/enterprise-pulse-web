import { Link, useNavigate } from '@tanstack/react-router';
import type { CellContext, ColumnDef } from '@tanstack/react-table';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  usePayrollPeriodsApprove,
  usePayrollPeriodsFindOne,
  usePayrollPeriodsPay,
  usePayrollPeriodsRecalculate,
  usePayrollPeriodsRemove,
  usePayrollPeriodsReopen,
  usePayrollPeriodsReversePayment,
} from '@/api/generated/endpoints/payroll/payroll';
import type { PayrollPeriodDetailDto, PayslipRowDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { AccountSelect, useAccountOptions } from '@/features/finance/finance-components';
import { KpiCard } from '@/features/reports/report-components';
import { today } from '@/features/trade/trade-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney, formatQuantity } from '@/shared/lib/format';
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
import { Skeleton } from '@/shared/ui/skeleton';
import { PayrollStatusBadge, periodLabel, useInvalidatePayroll } from './payroll-components';

export function PayrollPeriodPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const invalidate = useInvalidatePayroll();
  const { data: period, isLoading } = usePayrollPeriodsFindOne(id);
  const recalculate = usePayrollPeriodsRecalculate();
  const approve = usePayrollPeriodsApprove();
  const reopen = usePayrollPeriodsReopen();
  const reverse = usePayrollPeriodsReversePayment();
  const remove = usePayrollPeriodsRemove();
  const [paying, setPaying] = useState(false);
  const columns = usePayslipColumns(period?.currencyCode ?? 'TRY');

  if (!period) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const done = (message: string) => async () => {
    toast.success(message);
    await invalidate();
  };
  const busy =
    recalculate.isPending ||
    approve.isPending ||
    reopen.isPending ||
    reverse.isPending ||
    remove.isPending;
  const currency = period.currencyCode;
  const name = periodLabel(period);

  const handleExport = (format: ExportFormat) =>
    exportTable(
      format,
      `payroll-${period.year}-${String(period.month).padStart(2, '0')}`,
      [
        { header: t('payroll.employeeNo'), value: (r) => r.employeeNo },
        { header: t('payroll.employee'), value: (r) => r.employeeName },
        { header: t('payroll.department'), value: (r) => r.departmentName },
        { header: t('payroll.monthlySalary'), value: (r) => Number(r.monthlySalary) },
        { header: t('payroll.payDays'), value: (r) => r.payDays },
        { header: t('payroll.overtimeHours'), value: (r) => Number(r.overtimeHours) },
        { header: t('payroll.gross'), value: (r) => Number(r.grossPay) },
        { header: t('payroll.sgkEmployee'), value: (r) => Number(r.sgkEmployee) },
        { header: t('payroll.unemploymentEmployee'), value: (r) => Number(r.unemploymentEmployee) },
        { header: t('payroll.incomeTax'), value: (r) => Number(r.incomeTaxPayable) },
        { header: t('payroll.stampTax'), value: (r) => Number(r.stampTaxPayable) },
        { header: t('payroll.otherDeductions'), value: (r) => Number(r.otherDeductions) },
        { header: t('payroll.net'), value: (r) => Number(r.netPay) },
        { header: t('payroll.employerCost'), value: (r) => Number(r.employerCost) },
      ],
      period.payslips,
    );

  return (
    <>
      <Link
        to="/payroll"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />
        {t('payroll.title')}
      </Link>
      <PageHeader
        title={t('payroll.periodTitle', { period: name })}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{period.number}</code>
            <PayrollStatusBadge status={period.status} imported={period.imported} />
          </span>
        }
        actions={
          <>
            {period.canDelete && (
              <ConfirmDialog
                description={t('payroll.messages.deleteConfirm')}
                onConfirm={() =>
                  remove.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('payroll.messages.deleted'));
                        await navigate({ to: '/payroll' });
                        await invalidate();
                      },
                    },
                  )
                }
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
              />
            )}
            {period.canEdit && (
              <Button
                variant="outline"
                disabled={busy}
                title={t('payroll.recalculateHint')}
                onClick={() =>
                  recalculate.mutate(
                    { id },
                    { onSuccess: done(t('payroll.messages.recalculated')) },
                  )
                }
              >
                {recalculate.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {t('payroll.actions.recalculate')}
              </Button>
            )}
            {period.canReopen && (
              <ConfirmDialog
                title={t('payroll.messages.reopenTitle')}
                description={t('payroll.messages.reopenConfirm')}
                confirmLabel={t('payroll.actions.reopen')}
                onConfirm={() =>
                  reopen.mutate({ id }, { onSuccess: done(t('payroll.messages.reopened')) })
                }
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Undo2 /> {t('payroll.actions.reopen')}
                  </Button>
                }
              />
            )}
            {period.canReversePayment && (
              <ConfirmDialog
                title={t('payroll.messages.reverseTitle')}
                description={t('payroll.messages.reverseConfirm')}
                confirmLabel={t('payroll.actions.reversePayment')}
                onConfirm={() =>
                  reverse.mutate({ id }, { onSuccess: done(t('payroll.messages.reversed')) })
                }
                trigger={
                  <Button variant="outline" disabled={busy}>
                    <Undo2 /> {t('payroll.actions.reversePayment')}
                  </Button>
                }
              />
            )}
            {period.canApprove && (
              <ConfirmDialog
                title={t('payroll.messages.approveTitle')}
                description={t('payroll.messages.approveConfirm', { count: period.employeeCount })}
                confirmLabel={t('payroll.actions.approve')}
                onConfirm={() =>
                  approve.mutate({ id }, { onSuccess: done(t('payroll.messages.approved')) })
                }
                trigger={
                  <Button disabled={busy}>
                    <Check /> {t('payroll.actions.approve')}
                  </Button>
                }
              />
            )}
            {period.canPay && (
              <Button onClick={() => setPaying(true)}>
                <Wallet /> {t('payroll.actions.pay')}
              </Button>
            )}
          </>
        }
      />

      {period.missingSalaryNames.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          {t('payroll.messages.leftOut', {
            count: period.missingSalaryNames.length,
            names: period.missingSalaryNames.join(', '),
          })}
        </p>
      )}
      {period.status === 'DRAFT' && (
        <p className="text-muted-foreground mb-4 text-sm">{t('payroll.draftHint')}</p>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard
          label={t('payroll.gross')}
          value={formatMoney(period.grossTotal, currency)}
          hint={t('payroll.employeesCount', { count: period.employeeCount })}
        />
        <KpiCard label={t('payroll.sgkTotal')} value={formatMoney(period.sgkTotal, currency)} />
        <KpiCard label={t('payroll.taxTotal')} value={formatMoney(period.taxTotal, currency)} />
        <KpiCard
          label={t('payroll.net')}
          value={formatMoney(period.netTotal, currency)}
          hint={
            Number(period.deductionTotal) > 0
              ? t('payroll.deductionsHint', {
                  amount: formatMoney(period.deductionTotal, currency),
                })
              : undefined
          }
        />
        <KpiCard
          label={t('payroll.employerCost')}
          value={formatMoney(period.employerCostTotal, currency)}
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('common.details')}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('payroll.createdBy')}>
              {period.createdByName} · {formatDate(period.createdAt)}
            </Field>
            {period.approvedAt && (
              <Field label={t('payroll.approvedBy')}>
                {period.approvedByName ?? '—'} · {formatDateTime(period.approvedAt)}
              </Field>
            )}
            {period.imported && (
              <Field label={t('payroll.paymentDate')}>
                {formatDate(period.paymentDate)}
                <span className="text-muted-foreground block text-xs">
                  {t('payroll.importedHint')}
                </span>
              </Field>
            )}
            {period.paidAt && !period.imported && (
              <>
                <Field label={t('payroll.paymentDate')}>{formatDate(period.paymentDate)}</Field>
                <Field label={t('payroll.paymentAccount')}>
                  {period.paymentAccountId && can('finance:read') ? (
                    <Link
                      to="/finance/accounts/$id"
                      params={{ id: period.paymentAccountId }}
                      className="text-primary hover:underline"
                    >
                      {period.paymentAccountName}
                    </Link>
                  ) : (
                    period.paymentAccountName
                  )}
                </Field>
                <Field label={t('payroll.paidBy')}>{period.paidByName}</Field>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
      <DataTable
        columns={columns}
        data={period.payslips}
        searchable={false}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/payroll/payslips/$id', params: { id: row.id } })}
      />
      <Dialog open={paying} onOpenChange={setPaying}>
        <DialogContent>
          <PayForm period={period} onClose={() => setPaying(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function usePayslipColumns(currency: string) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<PayslipRowDto, unknown>[]>(() => {
    const money =
      (pick: (row: PayslipRowDto) => string, strong?: boolean) =>
      ({ row }: CellContext<PayslipRowDto, unknown>) => (
        <span className={strong ? 'font-medium tabular-nums' : 'tabular-nums'}>
          {formatMoney(pick(row.original), currency)}
        </span>
      );
    return [
      {
        id: 'employee',
        header: t('payroll.employee'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.employeeName}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.departmentName ?? row.original.employeeNo}
            </span>
          </span>
        ),
      },
      {
        id: 'payDays',
        header: t('payroll.payDays'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.payDays}
            {row.original.missingDays > 0 && (
              <span className="text-destructive block text-xs">
                {t('payroll.missingShort', { count: row.original.missingDays })}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'overtime',
        header: t('payroll.overtimeHours'),
        cell: ({ row }) =>
          Number(row.original.overtimeHours) > 0 ? (
            <span className="tabular-nums">{formatQuantity(row.original.overtimeHours, 'sa')}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: 'gross', header: t('payroll.gross'), cell: money((r) => r.grossPay) },
      {
        id: 'sgk',
        header: t('payroll.sgkEmployeeShort'),
        cell: money((r) => String(Number(r.sgkEmployee) + Number(r.unemploymentEmployee))),
      },
      { id: 'incomeTax', header: t('payroll.incomeTax'), cell: money((r) => r.incomeTaxPayable) },
      { id: 'stampTax', header: t('payroll.stampTax'), cell: money((r) => r.stampTaxPayable) },
      {
        id: 'deductions',
        header: t('payroll.otherDeductions'),
        cell: ({ row }) =>
          Number(row.original.otherDeductions) > 0 ? (
            <span className="tabular-nums">
              {formatMoney(row.original.otherDeductions, currency)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      { id: 'net', header: t('payroll.net'), cell: money((r) => r.netPay, true) },
      { id: 'cost', header: t('payroll.employerCost'), cell: money((r) => r.employerCost) },
    ];
  }, [t, currency]);
}

/** Mounted with the dialog content, so every opening starts from fresh values. */
function PayForm({ period, onClose }: { period: PayrollPeriodDetailDto; onClose: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePayroll();
  const pay = usePayrollPeriodsPay();
  const accounts = useAccountOptions({ types: ['BANK'], currencyCode: period.currencyCode });
  const [picked, setPicked] = useState('');
  const [date, setDate] = useState(today());
  const accountId = picked || (accounts.length === 1 ? accounts[0].id : '');

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('payroll.pay.title')}</DialogTitle>
        <DialogDescription>
          {t('payroll.pay.description', {
            period: periodLabel(period),
            count: period.employeeCount,
            amount: formatMoney(period.netTotal, period.currencyCode),
          })}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('payroll.pay.account')}</Label>
          <AccountSelect value={accountId} onChange={setPicked} accounts={accounts} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payroll-pay-date">{t('payroll.pay.date')}</Label>
          <Input
            id="payroll-pay-date"
            type="date"
            max={today()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          disabled={!accountId || !date || pay.isPending}
          onClick={() =>
            pay.mutate(
              { id: period.id, data: { accountId, paymentDate: date } },
              {
                onSuccess: async () => {
                  toast.success(t('payroll.messages.paid'));
                  onClose();
                  await invalidate();
                },
              },
            )
          }
        >
          {pay.isPending ? <Loader2 className="animate-spin" /> : <Wallet />}
          {t('payroll.actions.pay')}
        </Button>
      </DialogFooter>
    </>
  );
}
