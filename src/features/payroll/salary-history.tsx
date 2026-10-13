import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useSalariesCreate,
  useSalariesHistory,
  useSalariesRemove,
} from '@/api/generated/endpoints/payroll/payroll';
import type { SalaryRecordDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { emptyToNull } from '@/features/hr/hr-components';
import { today, useBaseCurrency } from '@/features/trade/trade-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { useInvalidatePayroll } from './payroll-components';

const salarySchema = z.object({
  effectiveFrom: v.requiredString(),
  grossSalary: z.coerce.number({ invalid_type_error: 'validation.number' }).min(1),
  note: z.string(),
});

/** Salary records of one employee, newest first; used on the salaries page and employee detail. */
export function SalaryHistory({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const currency = useBaseCurrency();
  const invalidate = useInvalidatePayroll();
  const { data, isLoading } = useSalariesHistory(employeeId);
  const create = useSalariesCreate();
  const remove = useSalariesRemove();
  const [open, setOpen] = useState(false);
  const current = data?.[0];

  const columns = useMemo<ColumnDef<SalaryRecordDto, unknown>[]>(
    () => [
      {
        id: 'effectiveFrom',
        header: t('payroll.salaries.effectiveFrom'),
        cell: ({ row }) => formatDate(row.original.effectiveFrom),
      },
      {
        id: 'grossSalary',
        header: t('payroll.salaries.gross'),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatMoney(row.original.grossSalary, currency)}
          </span>
        ),
      },
      {
        id: 'changePercent',
        header: t('payroll.salaries.change'),
        cell: ({ row }) => {
          const change = row.original.changePercent;
          if (change === null) return <span className="text-muted-foreground">—</span>;
          const value = Number(change);
          return (
            <span
              className={
                value > 0
                  ? 'text-emerald-600 tabular-nums dark:text-emerald-400'
                  : 'text-destructive tabular-nums'
              }
            >
              {value > 0 ? '+' : ''}
              {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
            </span>
          );
        },
      },
      {
        id: 'note',
        header: t('common.notes'),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{row.original.note ?? '—'}</span>
        ),
      },
      {
        id: 'createdBy',
        header: t('payroll.salaries.createdBy'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.createdByName}
            <span className="text-muted-foreground block text-xs">
              {formatDate(row.original.createdAt)}
            </span>
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Can permission="payroll:update">
            <ConfirmDialog
              trigger={
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 />
                  </Button>
                </div>
              }
              onConfirm={() =>
                remove.mutate(
                  { id: row.original.id },
                  {
                    onSuccess: async () => {
                      toast.success(t('common.deleted'));
                      await invalidate();
                    },
                  },
                )
              }
            />
          </Can>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, currency],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={
          <Can permission="payroll:update">
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus /> {t('payroll.salaries.new')}
            </Button>
          </Can>
        }
      />
      <SimpleFormDialog<z.infer<typeof salarySchema>>
        open={open}
        onOpenChange={setOpen}
        title={t('payroll.salaries.new')}
        description={
          <p className="text-muted-foreground text-sm">{t('payroll.salaries.newHint')}</p>
        }
        schema={salarySchema}
        pending={create.isPending}
        defaultValues={{
          effectiveFrom: `${today().slice(0, 7)}-01`,
          grossSalary: current ? Number(current.grossSalary) : 0,
          note: '',
        }}
        fields={[
          { name: 'effectiveFrom', label: t('payroll.salaries.effectiveFrom'), type: 'date' },
          { name: 'grossSalary', label: t('payroll.salaries.gross'), type: 'number' },
          { name: 'note', label: t('common.notes'), type: 'textarea', wide: true },
        ]}
        onSubmit={(values) =>
          create.mutate(
            { data: { employeeId, ...values, note: emptyToNull(values.note) } },
            {
              onSuccess: async () => {
                toast.success(t('common.saved'));
                await invalidate();
                setOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}
