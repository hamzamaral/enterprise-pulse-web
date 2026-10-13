import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useBudgetEntriesCreate,
  useBudgetEntriesFindAll,
  useBudgetEntriesRemove,
  useBudgetItemsFindAll,
  useBudgetsOptions,
} from '@/api/generated/endpoints/budgets/budgets';
import type { BudgetEntriesFindAllParams, BudgetEntryDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { budgetYears, useInvalidateBudgets } from './budget-components';

const ALL = '__all__';
const today = () => new Date().toISOString().slice(0, 10);

const schema = z.object({
  itemId: z.string().min(1, 'validation.required'),
  departmentId: z.string(),
  entryDate: z.string().min(1, 'validation.required'),
  amount: z
    .string()
    .trim()
    .refine((value) => {
      const number = Number(value.replace(',', '.'));
      return value !== '' && Number.isFinite(number) && number !== 0;
    }, 'validation.number'),
  description: z.string().trim().min(3, 'validation.required').max(300),
});
type Values = z.infer<typeof schema>;

/** Actuals that no module records: rent, licences, campaign spend, service income. */
export function BudgetEntriesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const canUpdate = can('budgets:update');
  const invalidate = useInvalidateBudgets();
  const table = useTableState({ sort: [{ id: 'entryDate', desc: true }] });
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [itemId, setItemId] = useState(ALL);
  const [departmentId, setDepartmentId] = useState(ALL);
  const [creating, setCreating] = useState(false);
  const { data: items } = useBudgetItemsFindAll();
  const { data: options } = useBudgetsOptions({ query: { enabled: canUpdate } });
  const create = useBudgetEntriesCreate();
  const remove = useBudgetEntriesRemove();
  const params: BudgetEntriesFindAllParams = {
    ...table.params,
    year: year === ALL ? undefined : Number(year),
    itemId: itemId === ALL ? undefined : itemId,
    departmentId: departmentId === ALL ? undefined : departmentId,
  };
  const { data, isLoading } = useBudgetEntriesFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<BudgetEntryDto, unknown>[]>(
    () => [
      {
        id: 'entryDate',
        header: t('budgets.date'),
        cell: ({ row }) => formatDate(row.original.entryDate),
      },
      {
        id: 'item',
        header: t('budgets.item'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            <code className="text-muted-foreground mr-1 text-xs">{row.original.itemCode}</code>
            {row.original.itemName}
          </span>
        ),
      },
      {
        id: 'description',
        header: t('common.description'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-96 truncate" title={row.original.description}>
            {row.original.description}
          </span>
        ),
      },
      {
        id: 'department',
        header: t('budgets.department'),
        enableSorting: false,
        cell: ({ row }) => row.original.departmentName ?? t('budgets.companyWide'),
      },
      {
        id: 'amount',
        header: t('budgets.amount'),
        cell: ({ row }) => (
          <span
            className={cn(
              'tabular-nums',
              row.original.kind === 'INCOME' && 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {formatMoney(row.original.amount)}
          </span>
        ),
      },
      {
        id: 'createdAt',
        header: t('common.createdBy'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.createdByName}
            <span className="text-muted-foreground block text-xs">
              {formatDate(row.original.createdAt)}
            </span>
          </span>
        ),
      },
      ...(canUpdate
        ? [
            {
              id: 'actions',
              header: '',
              enableSorting: false,
              cell: ({ row }) => (
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t('common.delete')}
                    >
                      <Trash2 />
                    </Button>
                  }
                  onConfirm={() =>
                    remove.mutate(
                      { id: row.original.id },
                      {
                        onSuccess: async () => {
                          toast.success(t('budgets.entries.deleted'));
                          await invalidate();
                        },
                      },
                    )
                  }
                />
              ),
            } satisfies ColumnDef<BudgetEntryDto, unknown>,
          ]
        : []),
    ],
    [t, canUpdate, remove, invalidate],
  );

  return (
    <>
      <PageHeader
        title={t('budgets.entries.title')}
        description={t('budgets.entries.subtitle')}
        actions={
          <Can permission="budgets:update">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('budgets.entries.new')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        toolbar={
          <>
            <Select
              value={year}
              onValueChange={(value) => {
                setYear(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-28" aria-label={t('budgets.year')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('budgets.allYears')}</SelectItem>
                {budgetYears().map((value) => (
                  <SelectItem key={value} value={String(value)}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={itemId}
              onValueChange={(value) => {
                setItemId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-56" aria-label={t('budgets.item')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('budgets.allItems')}</SelectItem>
                {(items ?? []).map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.code} · {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {options && (
              <Select
                value={departmentId}
                onValueChange={(value) => {
                  setDepartmentId(value);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-48" aria-label={t('budgets.department')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('budgets.allDepartments')}</SelectItem>
                  {options.departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </>
        }
      />
      <SimpleFormDialog<Values>
        open={creating}
        onOpenChange={setCreating}
        title={t('budgets.entries.new')}
        description={
          <p className="text-muted-foreground text-sm">{t('budgets.entries.createHint')}</p>
        }
        schema={schema}
        pending={create.isPending}
        defaultValues={{
          itemId: '',
          departmentId: '',
          entryDate: today(),
          amount: '',
          description: '',
        }}
        fields={[
          {
            name: 'itemId',
            label: t('budgets.item'),
            type: 'select',
            required: true,
            wide: true,
            options: (items ?? [])
              .filter((i) => i.isActive)
              .map((i) => ({
                value: i.id,
                label: `${i.code} · ${i.name} (${t(`budgets.kind.${i.kind}`)})`,
              })),
          },
          {
            name: 'departmentId',
            label: t('budgets.department'),
            type: 'select',
            options: (options?.departments ?? []).map((d) => ({ value: d.id, label: d.name })),
          },
          { name: 'entryDate', label: t('budgets.date'), type: 'date' },
          { name: 'amount', label: t('budgets.amount'), type: 'number' },
          { name: 'description', label: t('common.description'), wide: true },
        ]}
        onSubmit={(values) =>
          create.mutate(
            {
              data: {
                itemId: values.itemId,
                departmentId: values.departmentId || null,
                entryDate: values.entryDate,
                amount: Number(values.amount.replace(',', '.')),
                description: values.description,
              },
            },
            {
              onSuccess: async () => {
                toast.success(t('budgets.entries.created'));
                await invalidate();
                setCreating(false);
              },
            },
          )
        }
      />
    </>
  );
}
