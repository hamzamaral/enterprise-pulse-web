import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, Loader2, Paperclip, Plus, Send, Trash2, X } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useExpenseCategoriesFindAll,
  useExpenseReportsCreate,
  useExpenseReportsFindOne,
  useExpenseReportsSubmit,
  useExpenseReportsUpdate,
  useExpenseReportsUploadReceipt,
} from '@/api/generated/endpoints/expenses/expenses';
import { useProjectsFindAll } from '@/api/generated/endpoints/projects/projects';
import type {
  ExpenseCategoryDto,
  ExpenseLineInputDto,
  ExpenseReportDetailDto,
} from '@/api/generated/model';
import { useMe, usePermission } from '@/features/auth/use-session';
import { useEmployeeOptions } from '@/features/hr/hr-components';
import { WORKING_STATUSES } from '@/features/projects/project-components';
import { parseDecimal } from '@/features/trade/document-math';
import { today, useBaseCurrency } from '@/features/trade/trade-components';
import { useCurrencyOptions } from '@/features/crm/crm-components';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Textarea } from '@/shared/ui/textarea';
import { isRated, useInvalidateExpenses } from './expense-components';

const NO_PROJECT = '__none__';

const lineSchema = z.object({
  categoryId: z.string().min(1, 'validation.required'),
  expenseDate: z.string().min(1, 'validation.required'),
  description: v.requiredString().pipe(z.string().min(2, 'validation.required')),
  merchant: z.string(),
  quantity: z.string(),
  amount: z.string(),
  vatAmount: z.string(),
  currencyCode: z.string(),
  exchangeRate: z.string(),
  receiptFileId: z.string().nullable(),
  receiptName: z.string().nullable(),
});

type LineValues = z.infer<typeof lineSchema>;

function buildSchema(categories: Map<string, ExpenseCategoryDto>) {
  return z
    .object({
      employeeId: z.string(),
      projectId: z.string(),
      title: v.requiredString().pipe(z.string().min(2, 'validation.required')),
      description: z.string(),
      lines: z.array(lineSchema).min(1),
    })
    .superRefine((values, ctx) => {
      const issue = (index: number, field: keyof LineValues, message = 'validation.number') =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, field], message });
      values.lines.forEach((line, index) => {
        const category = categories.get(line.categoryId);
        if (line.expenseDate > today()) issue(index, 'expenseDate', 'validation.required');
        if (!category) return;
        if (isRated(category.kind)) {
          if (!(parseDecimal(line.quantity) > 0)) issue(index, 'quantity');
          return;
        }
        const amount = parseDecimal(line.amount);
        if (!(amount > 0)) issue(index, 'amount');
        const vat = line.vatAmount ? parseDecimal(line.vatAmount) : 0;
        if (!(vat >= 0) || vat > amount) issue(index, 'vatAmount');
        if (line.exchangeRate && !(parseDecimal(line.exchangeRate) > 0)) {
          issue(index, 'exchangeRate');
        }
      });
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

const emptyLine = (currencyCode: string): LineValues => ({
  categoryId: '',
  expenseDate: today(),
  description: '',
  merchant: '',
  quantity: '1',
  amount: '',
  vatAmount: '',
  currencyCode,
  exchangeRate: '',
  receiptFileId: null,
  receiptName: null,
});

/** Amount of a line in the company currency, or null while a foreign rate is unknown. */
function lineBase(line: LineValues, category: ExpenseCategoryDto | undefined, base: string) {
  if (!category) return 0;
  if (isRated(category.kind)) return (parseDecimal(line.quantity) || 0) * Number(category.rate);
  const amount = parseDecimal(line.amount) || 0;
  if (line.currencyCode === base) return amount;
  const rate = parseDecimal(line.exchangeRate);
  return rate > 0 ? amount * rate : null;
}

export function ExpenseFormPage({ id }: { id?: string }) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const can = usePermission();
  const { data: report, isLoading } = useExpenseReportsFindOne(id ?? '', {
    query: { enabled: !!id },
  });
  const { data: categories } = useExpenseCategoriesFindAll();
  if (!id && me && !me.employeeId && !can('expenses:create')) {
    return (
      <>
        <PageHeader title={t('expenses.new')} />
        <p className="text-muted-foreground text-sm">{t('expenses.messages.noEmployee')}</p>
      </>
    );
  }
  if (id && !report) {
    if (!isLoading) return <RecordNotFound />;
    return <Skeleton className="h-96" />;
  }
  if (!categories) return <Skeleton className="h-96" />;
  if (report && !report.canEdit) return <RecordNotFound />;
  return <ExpenseForm report={report} categories={categories} />;
}

function ExpenseForm({
  report,
  categories,
}: {
  report?: ExpenseReportDetailDto;
  categories: ExpenseCategoryDto[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const base = useBaseCurrency();
  const can = usePermission();
  const forOthers = !report && can('expenses:create') && can('employees:read');
  const employees = useEmployeeOptions(forOthers);
  const { data: openProjects } = useProjectsFindAll({
    open: 'true',
    mine: forOthers ? undefined : 'true',
    pageSize: 100,
    sortBy: 'number',
    sortOrder: 'asc',
  });
  const projects = (openProjects?.data ?? [])
    .filter((p) => WORKING_STATUSES.includes(p.status))
    .map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` }));
  if (report?.projectId && !projects.some((p) => p.value === report.projectId)) {
    projects.unshift({
      value: report.projectId,
      label: `${report.projectNumber} · ${report.projectName}`,
    });
  }
  const invalidate = useInvalidateExpenses();
  const create = useExpenseReportsCreate();
  const update = useExpenseReportsUpdate();
  const submit = useExpenseReportsSubmit();
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const schema = useMemo(() => buildSchema(byId), [byId]);
  const active = categories.filter(
    (c) => c.isActive || report?.lines.some((l) => l.categoryId === c.id),
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: '',
      projectId: report?.projectId ?? NO_PROJECT,
      title: report?.title ?? '',
      description: report?.description ?? '',
      lines: report
        ? report.lines.map((line) => ({
            categoryId: line.categoryId,
            expenseDate: line.expenseDate.slice(0, 10),
            description: line.description,
            merchant: line.merchant ?? '',
            quantity: String(Number(line.quantity)),
            amount: line.categoryKind === 'RECEIPT' ? String(Number(line.amount)) : '',
            vatAmount: Number(line.vatAmount) ? String(Number(line.vatAmount)) : '',
            currencyCode: line.currencyCode,
            exchangeRate: line.currencyCode === base ? '' : String(Number(line.exchangeRate)),
            receiptFileId: line.receiptFileId,
            receiptName: line.receiptName,
          }))
        : [emptyLine(base)],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const amounts = watched.map((line) => lineBase(line, byId.get(line.categoryId), base));
  const total = amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
  const estimated = amounts.some((amount) => amount === null);
  const pending = create.isPending || update.isPending || submit.isPending;

  const save = (andSubmit: boolean) => (values: FormValues) => {
    const data = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      projectId: values.projectId === NO_PROJECT ? null : values.projectId,
      lines: values.lines.map((line): ExpenseLineInputDto => {
        const rated = isRated(byId.get(line.categoryId)?.kind ?? 'RECEIPT');
        return {
          categoryId: line.categoryId,
          expenseDate: line.expenseDate,
          description: line.description.trim(),
          merchant: line.merchant.trim() || null,
          receiptFileId: line.receiptFileId,
          ...(rated
            ? { quantity: parseDecimal(line.quantity) }
            : {
                amount: parseDecimal(line.amount),
                vatAmount: line.vatAmount ? parseDecimal(line.vatAmount) : 0,
                currencyCode: line.currencyCode,
                exchangeRate:
                  line.currencyCode !== base && line.exchangeRate
                    ? parseDecimal(line.exchangeRate)
                    : undefined,
              }),
        };
      }),
    };
    const done = async (saved: ExpenseReportDetailDto) => {
      if (andSubmit) {
        try {
          await submit.mutateAsync({ id: saved.id });
          toast.success(t('expenses.messages.submitted', { number: saved.number }));
        } catch {
          // the global handler shows the reason; the draft stays saved
        }
      } else {
        toast.success(t('expenses.messages.saved', { number: saved.number }));
      }
      await invalidate();
      await navigate({ to: '/expenses/$id', params: { id: saved.id } });
    };
    if (report) {
      update.mutate({ id: report.id, data }, { onSuccess: done });
    } else {
      create.mutate(
        { data: { ...data, employeeId: values.employeeId || undefined } },
        { onSuccess: done },
      );
    }
  };

  const back = report
    ? ({ to: '/expenses/$id', params: { id: report.id } } as const)
    : ({ to: '/expenses/my' } as const);

  return (
    <>
      <Link
        {...back}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {report ? report.number : t('expenses.myTitle')}
      </Link>
      <PageHeader
        title={report ? t('expenses.edit') : t('expenses.new')}
        description={report ? report.title : t('expenses.newHint')}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(save(false))} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('expenses.titleField')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('expenses.titlePlaceholder')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {forOthers && (
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('expenses.employee')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('expenses.onlyMine')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('expenses.project')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_PROJECT}>{t('expenses.projectNone')}</SelectItem>
                        {projects.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {field.value !== NO_PROJECT && (
                      <p className="text-muted-foreground text-xs">{t('expenses.projectHint')}</p>
                    )}
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t('expenses.description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder={t('expenses.descriptionPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{t('expenses.lines.title')}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lines.fields.length >= 100}
                onClick={() => lines.append(emptyLine(base))}
              >
                <Plus /> {t('expenses.lines.add')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {active.length === 0 && (
                <p className="text-muted-foreground text-sm">{t('expenses.lines.noCategories')}</p>
              )}
              {lines.fields.map((field, index) => (
                <LineEditor
                  key={field.id}
                  form={form}
                  index={index}
                  categories={active}
                  category={byId.get(watched[index]?.categoryId ?? '')}
                  amountBase={amounts[index]}
                  canRemove={lines.fields.length > 1}
                  onRemove={() => lines.remove(index)}
                />
              ))}
              <div className="flex flex-col items-end gap-1 pt-2">
                <div className="flex items-baseline gap-3">
                  <span className="text-muted-foreground text-sm">{t('expenses.total')}</span>
                  <span className="text-lg font-semibold tabular-nums">
                    {estimated && '≈ '}
                    {formatMoney(total, base)}
                  </span>
                </div>
                {estimated && (
                  <p className="text-muted-foreground text-xs">
                    {t('expenses.lines.foreignHint', { currency: base })}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link {...back}>{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending && !submit.isPending && <Loader2 className="animate-spin" />}
              {t('expenses.actions.save')}
            </Button>
            <Button type="button" disabled={pending} onClick={form.handleSubmit(save(true))}>
              {submit.isPending ? <Loader2 className="animate-spin" /> : <Send />}
              {t('expenses.actions.saveAndSubmit')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

function LineEditor({
  form,
  index,
  categories,
  category,
  amountBase,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<FormValues>;
  index: number;
  categories: ExpenseCategoryDto[];
  category: ExpenseCategoryDto | undefined;
  amountBase: number | null;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const currencies = useCurrencyOptions();
  const upload = useExpenseReportsUploadReceipt();
  const fileInput = useRef<HTMLInputElement>(null);
  const name = (field: keyof LineValues) => `lines.${index}.${field}` as const;
  const [currencyCode, receiptName] = useWatch({
    control: form.control,
    name: [name('currencyCode'), name('receiptName')],
  });
  const rated = category ? isRated(category.kind) : false;
  const overLimit =
    category?.limitAmount != null &&
    amountBase !== null &&
    amountBase > Number(category.limitAmount);
  const missingReceipt = category?.kind === 'RECEIPT' && category.requiresReceipt && !receiptName;

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { data: { file } },
      {
        onSuccess: (saved) => {
          form.setValue(name('receiptFileId'), saved.id, { shouldDirty: true });
          form.setValue(name('receiptName'), saved.originalName, { shouldDirty: true });
        },
      },
    );
  };

  return (
    <div className="bg-muted/30 space-y-3 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-12">
        <FormField
          control={form.control}
          name={name('categoryId')}
          render={({ field }) => (
            <FormItem className="sm:col-span-3">
              <FormLabel>{t('expenses.lines.category')}</FormLabel>
              <Select value={field.value as string} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('common.select')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={name('expenseDate')}
          render={({ field }) => (
            <FormItem className="sm:col-span-2">
              <FormLabel>{t('expenses.lines.date')}</FormLabel>
              <FormControl>
                <Input type="date" max={today()} {...field} value={field.value as string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={name('description')}
          render={({ field }) => (
            <FormItem className={rated ? 'sm:col-span-5' : 'sm:col-span-4'}>
              <FormLabel>{t('expenses.lines.description')}</FormLabel>
              <FormControl>
                <Input maxLength={300} {...field} value={field.value as string} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {rated ? (
          <FormField
            control={form.control}
            name={name('quantity')}
            render={({ field }) => (
              <FormItem className="sm:col-span-2">
                <FormLabel>
                  {category?.kind === 'MILEAGE' ? t('expenses.lines.km') : t('expenses.lines.days')}
                </FormLabel>
                <FormControl>
                  <Input inputMode="decimal" {...field} value={field.value as string} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <FormField
            control={form.control}
            name={name('merchant')}
            render={({ field }) => (
              <FormItem className="sm:col-span-3">
                <FormLabel>{t('expenses.lines.merchant')}</FormLabel>
                <FormControl>
                  <Input maxLength={150} {...field} value={field.value as string} />
                </FormControl>
              </FormItem>
            )}
          />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {category && !rated && (
          <>
            <FormField
              control={form.control}
              name={name('amount')}
              render={({ field }) => (
                <FormItem className="w-32">
                  <FormLabel>{t('expenses.lines.amount')}</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" {...field} value={field.value as string} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={name('vatAmount')}
              render={({ field }) => (
                <FormItem className="w-28">
                  <FormLabel>{t('expenses.lines.vat')}</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" {...field} value={field.value as string} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={name('currencyCode')}
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormLabel>{t('expenses.lines.currency')}</FormLabel>
                  <Select value={field.value as string} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            {currencyCode !== base && (
              <FormField
                control={form.control}
                name={name('exchangeRate')}
                render={({ field }) => (
                  <FormItem className="w-28">
                    <FormLabel>{t('expenses.lines.rate')}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        placeholder={t('expenses.lines.rateAuto')}
                        {...field}
                        value={field.value as string}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="flex h-9 items-center gap-1">
              <input
                ref={fileInput}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              {receiptName ? (
                <>
                  <ToneBadge tone="success">
                    <Paperclip className="size-3" />
                    <span className="max-w-40 truncate">{receiptName as string}</span>
                  </ToneBadge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t('expenses.lines.removeReceipt')}
                    onClick={() => {
                      form.setValue(name('receiptFileId'), null, { shouldDirty: true });
                      form.setValue(name('receiptName'), null, { shouldDirty: true });
                    }}
                  >
                    <X />
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={upload.isPending}
                  onClick={() => fileInput.current?.click()}
                >
                  {upload.isPending ? <Loader2 className="animate-spin" /> : <Paperclip />}
                  {upload.isPending ? t('expenses.lines.uploading') : t('expenses.lines.attach')}
                </Button>
              )}
            </div>
          </>
        )}
        {category && rated && (
          <p className="text-muted-foreground flex h-9 items-center text-sm">
            {t(
              category.kind === 'MILEAGE'
                ? 'expenses.lines.mileageHint'
                : 'expenses.lines.perDiemHint',
              { rate: formatMoney(category.rate, base) },
            )}
          </p>
        )}
        <div className="ml-auto flex h-9 items-center gap-2">
          {missingReceipt && (
            <ToneBadge tone="warning">{t('expenses.lines.missingReceipt')}</ToneBadge>
          )}
          {overLimit && (
            <span
              title={t('expenses.lines.overLimitHint', {
                limit: formatMoney(category?.limitAmount, base),
              })}
            >
              <ToneBadge tone="danger">
                <AlertTriangle className="size-3" />
                {t('expenses.lines.overLimit')}
              </ToneBadge>
            </span>
          )}
          {category && (
            <span className="font-medium tabular-nums">
              {amountBase === null ? '—' : formatMoney(amountBase, base)}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={!canRemove}
            aria-label={t('expenses.lines.remove')}
            onClick={onRemove}
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  );
}
