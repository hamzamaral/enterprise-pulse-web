import { Link } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { usePayslipsFindOne, usePayslipsUpdate } from '@/api/generated/endpoints/payroll/payroll';
import type { PayslipDetailDto, PayslipItemKind } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  AmountRow,
  PayrollStatusBadge,
  periodLabel,
  useInvalidatePayroll,
} from './payroll-components';

const BACK_LINK =
  'text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm print:hidden';

export function PayslipPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const { data: slip, isLoading } = usePayslipsFindOne(id);
  const [editing, setEditing] = useState(false);

  if (!slip) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const staff = can('payroll:read');
  const money = (value: string) => formatMoney(value, slip.currencyCode);
  const minus = (value: string) => (Number(value) > 0 ? `−${money(value)}` : money(value));
  const earnings = slip.items.filter((item) => item.kind === 'EARNING');
  const deductions = slip.items.filter((item) => item.kind === 'DEDUCTION');
  const totalDeductions = Number(slip.grossPay) - Number(slip.netPay);

  return (
    <>
      {staff ? (
        <Link to="/payroll/$id" params={{ id: slip.periodId }} className={BACK_LINK}>
          <ArrowLeft className="size-4" />
          {t('payroll.periodTitle', { period: periodLabel(slip) })}
        </Link>
      ) : (
        <Link to="/payroll/my" className={BACK_LINK}>
          <ArrowLeft className="size-4" />
          {t('payroll.myTitle')}
        </Link>
      )}
      <PageHeader
        title={t('payroll.payslipTitle', { period: periodLabel(slip) })}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{slip.employeeName}</span>
            <PayrollStatusBadge status={slip.status} />
          </span>
        }
        actions={
          <div className="flex gap-2 print:hidden">
            {slip.canEdit && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t('payroll.actions.print')}
            </Button>
          </div>
        }
      />

      <Card className="print:border-0 print:shadow-none">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">{slip.companyName}</CardTitle>
              <p className="text-muted-foreground text-sm">
                {t('payroll.payslip')} · {periodLabel(slip)}
              </p>
            </div>
            <code className="text-muted-foreground text-xs">{slip.periodNumber}</code>
          </div>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Field label={t('payroll.employee')}>{slip.employeeName}</Field>
            <Field label={t('payroll.employeeNo')}>{slip.employeeNo}</Field>
            <Field label={t('payroll.nationalId')}>{slip.nationalId ?? '—'}</Field>
            <Field label={t('payroll.department')}>{slip.departmentName ?? '—'}</Field>
            <Field label={t('payroll.position')}>{slip.positionName ?? '—'}</Field>
            <Field label={t('payroll.hireDate')}>{formatDate(slip.hireDate)}</Field>
          </dl>
        </CardHeader>
        <CardContent className="grid gap-8 pt-6 lg:grid-cols-2">
          <section>
            <h3 className="mb-3 font-medium">{t('payroll.earnings')}</h3>
            <dl className="space-y-2 text-sm">
              <AmountRow
                label={t('payroll.basePay')}
                hint={t('payroll.daysOf', { days: slip.payDays })}
                value={money(slip.basePay)}
              />
              {Number(slip.overtimeHours) > 0 && (
                <AmountRow
                  label={t('payroll.overtimePay')}
                  hint={formatQuantity(slip.overtimeHours, t('payroll.hoursUnit'))}
                  value={money(slip.overtimePay)}
                />
              )}
              {earnings.map((item) => (
                <AmountRow key={item.id} label={item.description} value={money(item.amount)} />
              ))}
              <AmountRow strong label={t('payroll.gross')} value={money(slip.grossPay)} />
            </dl>
          </section>
          <section>
            <h3 className="mb-3 font-medium">{t('payroll.deductions')}</h3>
            <dl className="space-y-2 text-sm">
              <AmountRow label={t('payroll.sgkEmployee')} value={minus(slip.sgkEmployee)} />
              <AmountRow
                label={t('payroll.unemploymentEmployee')}
                value={minus(slip.unemploymentEmployee)}
              />
              <AmountRow label={t('payroll.incomeTax')} value={minus(slip.incomeTax)} />
              <AmountRow
                muted
                label={t('payroll.incomeTaxExemption')}
                value={money(slip.incomeTaxExemption)}
              />
              <AmountRow label={t('payroll.stampTax')} value={minus(slip.stampTax)} />
              <AmountRow
                muted
                label={t('payroll.stampTaxExemption')}
                value={money(slip.stampTaxExemption)}
              />
              {deductions.map((item) => (
                <AmountRow key={item.id} label={item.description} value={minus(item.amount)} />
              ))}
              <AmountRow
                strong
                label={t('payroll.totalDeductions')}
                value={minus(totalDeductions.toFixed(2))}
              />
            </dl>
          </section>
          <section className="bg-primary/5 flex items-center justify-between rounded-lg p-4 lg:col-span-2">
            <span className="font-medium">{t('payroll.netPay')}</span>
            <span className="text-2xl font-semibold tabular-nums">{money(slip.netPay)}</span>
          </section>
          <dl className="grid gap-4 text-sm sm:grid-cols-3 lg:col-span-2 lg:grid-cols-6">
            <Field label={t('payroll.payDays')}>
              {slip.payDays}
              {slip.missingDays > 0 && (
                <span className="text-muted-foreground block text-xs">
                  {t('payroll.missingShort', { count: slip.missingDays })}
                </span>
              )}
            </Field>
            <Field label={t('payroll.sgkBase')}>{money(slip.sgkBase)}</Field>
            <Field label={t('payroll.incomeTaxBase')}>{money(slip.incomeTaxBase)}</Field>
            <Field label={t('payroll.cumulativeTaxBase')}>{money(slip.cumulativeTaxBase)}</Field>
            <Field label={t('payroll.employerContributions')}>
              {money(String(Number(slip.sgkEmployer) + Number(slip.unemploymentEmployer)))}
            </Field>
            <Field label={t('payroll.employerCost')}>{money(slip.employerCost)}</Field>
          </dl>
          {slip.paymentDate && (
            <p className="text-muted-foreground text-sm lg:col-span-2">
              {t('payroll.paidOn', { date: formatDate(slip.paymentDate) })}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-2xl">
          <EditForm slip={slip} onClose={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ItemDraft {
  key: number;
  kind: PayslipItemKind;
  description: string;
  amount: string;
}

/** Mounted with the dialog content, so every opening starts from the saved payslip. */
function EditForm({ slip, onClose }: { slip: PayslipDetailDto; onClose: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePayroll();
  const update = usePayslipsUpdate();
  const [missingDays, setMissingDays] = useState(String(slip.missingDays));
  const [overtime, setOvertime] = useState(String(Number(slip.overtimeHours)));
  const [items, setItems] = useState<ItemDraft[]>(
    slip.items.map((item, index) => ({
      key: index,
      kind: item.kind,
      description: item.description,
      amount: String(Number(item.amount)),
    })),
  );
  const missing = Number(missingDays);
  const hours = Number(overtime);
  const itemsValid = items.every(
    (item) => item.description.trim().length >= 2 && Number(item.amount) > 0,
  );
  const valid =
    Number.isInteger(missing) &&
    missing >= 0 &&
    missing <= slip.employedDays &&
    hours >= 0 &&
    hours <= 300 &&
    itemsValid;
  const change = (key: number, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{slip.employeeName}</DialogTitle>
        <DialogDescription>{t('payroll.editHint')}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="payslip-missing">{t('payroll.missingDays')}</Label>
          <Input
            id="payslip-missing"
            type="number"
            min={0}
            max={slip.employedDays}
            value={missingDays}
            onChange={(e) => setMissingDays(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="payslip-overtime">{t('payroll.overtimeHours')}</Label>
          <Input
            id="payslip-overtime"
            type="number"
            min={0}
            step={0.5}
            value={overtime}
            onChange={(e) => setOvertime(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t('payroll.items')}</Label>
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">{t('payroll.noItems')}</p>
        )}
        {items.map((item) => (
          <div key={item.key} className="grid grid-cols-[9rem_1fr_8rem_auto] gap-2">
            <Select
              value={item.kind}
              onValueChange={(kind) => change(item.key, { kind: kind as PayslipItemKind })}
            >
              <SelectTrigger aria-label={t('payroll.itemKind')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EARNING">{t('payroll.itemKinds.EARNING')}</SelectItem>
                <SelectItem value="DEDUCTION">{t('payroll.itemKinds.DEDUCTION')}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label={t('payroll.itemDescription')}
              placeholder={t('payroll.itemDescription')}
              value={item.description}
              onChange={(e) => change(item.key, { description: e.target.value })}
            />
            <Input
              aria-label={t('payroll.itemAmount')}
              type="number"
              min={0}
              step="0.01"
              value={item.amount}
              onChange={(e) => change(item.key, { amount: e.target.value })}
            />
            <Button
              variant="ghost"
              size="icon"
              aria-label={t('common.delete')}
              onClick={() => setItems((list) => list.filter((other) => other.key !== item.key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setItems((list) => [
              ...list,
              {
                key: Math.max(-1, ...list.map((i) => i.key)) + 1,
                kind: 'EARNING',
                description: '',
                amount: '',
              },
            ])
          }
        >
          <Plus /> {t('payroll.addItem')}
        </Button>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          disabled={!valid || update.isPending}
          onClick={() =>
            update.mutate(
              {
                id: slip.id,
                data: {
                  missingDays: missing,
                  overtimeHours: hours,
                  items: items.map((item) => ({
                    kind: item.kind,
                    description: item.description.trim(),
                    amount: Number(item.amount),
                  })),
                },
              },
              {
                onSuccess: async () => {
                  toast.success(t('common.saved'));
                  onClose();
                  await invalidate();
                },
              },
            )
          }
        >
          {update.isPending && <Loader2 className="animate-spin" />}
          {t('payroll.actions.saveAndCalculate')}
        </Button>
      </DialogFooter>
    </>
  );
}
