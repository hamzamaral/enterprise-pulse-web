import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getExpenseCategoriesFindAllQueryKey,
  useExpenseCategoriesCreate,
  useExpenseCategoriesFindAll,
  useExpenseCategoriesUpdate,
} from '@/api/generated/endpoints/expenses/expenses';
import { ExpenseCategoryKind, type ExpenseCategoryDto } from '@/api/generated/model';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';

const positive = (value: string) => !value || Number(value) > 0;

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Z0-9_-]{2,20}$/, 'validation.code'),
    name: v.requiredString().pipe(z.string().min(2, 'validation.required')),
    kind: z.nativeEnum(ExpenseCategoryKind),
    rate: z.string().refine(positive, 'validation.number'),
    limitAmount: z.string().refine(positive, 'validation.number'),
    requiresReceipt: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.kind !== 'RECEIPT' && !values.rate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rate'],
        message: 'expenses.categories.rateRequired',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export function ExpenseSettingsPage() {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const { data, isLoading } = useExpenseCategoriesFindAll();
  const create = useExpenseCategoriesCreate();
  const update = useExpenseCategoriesUpdate();
  const [editor, setEditor] = useState<{ open: boolean; item: ExpenseCategoryDto | null }>({
    open: false,
    item: null,
  });

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getExpenseCategoriesFindAllQueryKey());
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<ExpenseCategoryDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <span className="flex items-center gap-2 font-medium">
            {row.original.name}
            <code className="text-muted-foreground text-xs font-normal">{row.original.code}</code>
          </span>
        ),
      },
      {
        id: 'kind',
        header: t('expenses.categories.kind'),
        cell: ({ row }) => (
          <ToneBadge tone={row.original.kind === 'RECEIPT' ? 'neutral' : 'info'}>
            {t(`expenses.kinds.${row.original.kind}`)}
          </ToneBadge>
        ),
      },
      {
        id: 'rate',
        header: t('expenses.categories.rate'),
        cell: ({ row }) =>
          row.original.rate ? (
            <span className="tabular-nums">{formatMoney(row.original.rate, base)}</span>
          ) : (
            '—'
          ),
      },
      {
        id: 'limit',
        header: t('expenses.categories.limit'),
        cell: ({ row }) =>
          row.original.limitAmount ? (
            <span className="tabular-nums">{formatMoney(row.original.limitAmount, base)}</span>
          ) : (
            <span className="text-muted-foreground">{t('expenses.categories.noLimit')}</span>
          ),
      },
      {
        id: 'requiresReceipt',
        header: t('expenses.categories.requiresReceipt'),
        cell: ({ row }) =>
          row.original.kind === 'RECEIPT'
            ? row.original.requiresReceipt
              ? t('common.yes')
              : t('common.no')
            : '—',
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('common.edit')}
              onClick={() => setEditor({ open: true, item: row.original })}
            >
              <Pencil />
            </Button>
          </div>
        ),
      },
    ],
    [t, base],
  );

  const item = editor.item;
  return (
    <>
      <PageHeader
        title={t('expenses.categories.title')}
        description={t('expenses.categories.subtitle')}
        actions={
          <Button onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('expenses.categories.new')}
          </Button>
        }
      />
      <DataTable columns={columns} data={data} isLoading={isLoading} searchable={false} />
      <SimpleFormDialog<FormValues>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={item ? item.name : t('expenses.categories.new')}
        description={t('expenses.categories.rateHint')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: item?.code ?? '',
          name: item?.name ?? '',
          kind: item?.kind ?? 'RECEIPT',
          rate: item?.rate ? String(Number(item.rate)) : '',
          limitAmount: item?.limitAmount ? String(Number(item.limitAmount)) : '',
          requiresReceipt: item?.requiresReceipt ?? true,
          isActive: item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'YEMEK', disabled: !!item },
          { name: 'name', label: t('common.name') },
          {
            name: 'kind',
            label: t('expenses.categories.kind'),
            type: 'select',
            required: true,
            disabled: !!item,
            options: Object.values(ExpenseCategoryKind).map((kind) => ({
              value: kind,
              label: t(`expenses.kinds.${kind}`),
            })),
          },
          { name: 'rate', label: `${t('expenses.categories.rate')} (${base})`, type: 'number' },
          {
            name: 'limitAmount',
            label: `${t('expenses.categories.limit')} (${base})`,
            type: 'number',
          },
          {
            name: 'requiresReceipt',
            label: t('expenses.categories.requiresReceipt'),
            type: 'switch',
          },
          ...(item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={({ code, kind, rate, limitAmount, ...rest }) => {
          const values = {
            ...rest,
            name: rest.name.trim(),
            rate: rate ? Number(rate) : null,
            limitAmount: limitAmount ? Number(limitAmount) : null,
          };
          if (item) update.mutate({ id: item.id, data: values }, { onSuccess });
          else create.mutate({ data: { ...values, code, kind } }, { onSuccess });
        }}
      />
    </>
  );
}
