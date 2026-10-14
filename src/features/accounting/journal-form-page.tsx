import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useAccountingOptions,
  useJournalEntriesCreate,
  useJournalEntriesFindOne,
  useJournalEntriesPost,
  useJournalEntriesUpdate,
} from '@/api/generated/endpoints/accounting/accounting';
import type {
  AccountingOptionsDto,
  JournalEntryDetailDto,
  JournalLineInputDto,
} from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { parseDecimal } from '@/features/trade/document-math';
import { today, useBaseCurrency } from '@/features/trade/trade-components';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { useInvalidateAccounting } from './accounting-components';
import { OptionPicker, type PickerGroup } from './option-picker';

const amount = (value: string) => (value.trim() ? parseDecimal(value) : 0);
const round2 = (value: number) => Math.round(value * 100) / 100;

const lineSchema = z.object({
  accountId: z.string().min(1, 'validation.required'),
  party: z.string(),
  description: z.string().max(200),
  debit: z.string(),
  credit: z.string(),
});

type LineValues = z.infer<typeof lineSchema>;

const schema = z
  .object({
    entryDate: z.string().min(1, 'validation.required'),
    description: z.string().trim().min(3, 'validation.required').max(300),
    lines: z.array(lineSchema).min(2),
  })
  .superRefine((values, ctx) => {
    values.lines.forEach((line, index) => {
      const debit = amount(line.debit);
      const credit = amount(line.credit);
      const issue = (field: 'debit' | 'credit', message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, field], message });
      if (Number.isNaN(debit) || debit < 0) issue('debit', 'validation.number');
      if (Number.isNaN(credit) || credit < 0) issue('credit', 'validation.number');
      if (debit > 0 && credit > 0) issue('credit', 'accounting.form.oneSide');
      if (!(debit > 0) && !(credit > 0)) issue('debit', 'accounting.form.amountRequired');
    });
  });

type FormValues = z.infer<typeof schema>;

const emptyLine = (debit = '', credit = ''): LineValues => ({
  accountId: '',
  party: '',
  description: '',
  debit,
  credit,
});

const partyValue = (line: { partnerId: string | null; employeeId: string | null }) =>
  line.partnerId ? `p:${line.partnerId}` : line.employeeId ? `e:${line.employeeId}` : '';

const formatInput = (value: string) => (Number(value) ? String(Number(value)) : '');

export function JournalFormPage({ id }: { id?: string }) {
  const { data: entry, isLoading } = useJournalEntriesFindOne(id ?? '', {
    query: { enabled: !!id },
  });
  const { data: options } = useAccountingOptions();
  if (id && !entry) {
    if (!isLoading) return <RecordNotFound />;
    return <Skeleton className="h-96" />;
  }
  if (entry && !entry.canEdit) return <RecordNotFound />;
  if (!options) return <Skeleton className="h-96" />;
  return <JournalForm entry={entry} options={options} />;
}

function JournalForm({
  entry,
  options,
}: {
  entry?: JournalEntryDetailDto;
  options: AccountingOptionsDto;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const currency = useBaseCurrency();
  const invalidate = useInvalidateAccounting();
  const create = useJournalEntriesCreate();
  const update = useJournalEntriesUpdate();
  const post = useJournalEntriesPost();
  const pending = create.isPending || update.isPending || post.isPending;

  const accountGroups = useMemo<PickerGroup[]>(() => {
    const accounts = options.accounts.map((a) => ({ value: a.id, code: a.code, label: a.name }));
    for (const line of entry?.lines ?? []) {
      if (!accounts.some((a) => a.value === line.accountId)) {
        accounts.push({ value: line.accountId, code: line.accountCode, label: line.accountName });
      }
    }
    return [{ options: accounts }];
  }, [options, entry]);
  const partyGroups = useMemo<PickerGroup[]>(
    () => [
      {
        heading: t('accounting.form.partners'),
        options: options.partners.map((p) => ({ value: `p:${p.id}`, code: p.code, label: p.name })),
      },
      {
        heading: t('accounting.form.employees'),
        options: options.employees.map((e) => ({
          value: `e:${e.id}`,
          code: e.code,
          label: e.name,
        })),
      },
    ],
    [options, t],
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      entryDate: entry?.entryDate.slice(0, 10) ?? today(),
      description: entry?.description ?? '',
      lines: entry
        ? entry.lines.map((line) => ({
            accountId: line.accountId,
            party: partyValue(line),
            description: line.description ?? '',
            debit: formatInput(line.debit),
            credit: formatInput(line.credit),
          }))
        : [emptyLine(), emptyLine()],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const watched = useWatch({ control: form.control, name: 'lines' });
  const totalDebit = round2(watched.reduce((sum, l) => sum + (amount(l.debit) || 0), 0));
  const totalCredit = round2(watched.reduce((sum, l) => sum + (amount(l.credit) || 0), 0));
  const difference = round2(totalDebit - totalCredit);

  const addLine = () => {
    if (difference > 0) lines.append(emptyLine('', String(difference)));
    else if (difference < 0) lines.append(emptyLine(String(-difference), ''));
    else lines.append(emptyLine());
  };

  const save = (andPost: boolean) => (values: FormValues) => {
    const data = {
      entryDate: values.entryDate,
      description: values.description.trim(),
      lines: values.lines.map((line): JournalLineInputDto => ({
        accountId: line.accountId,
        partnerId: line.party.startsWith('p:') ? line.party.slice(2) : null,
        employeeId: line.party.startsWith('e:') ? line.party.slice(2) : null,
        description: line.description.trim() || null,
        debit: amount(line.debit),
        credit: amount(line.credit),
      })),
    };
    const done = async (saved: JournalEntryDetailDto) => {
      if (andPost) {
        try {
          await post.mutateAsync({ id: saved.id });
          toast.success(t('accounting.journal.posted', { number: saved.number }));
        } catch {
          // the global handler shows the reason; the draft stays saved
        }
      } else {
        toast.success(t('accounting.journal.saved', { number: saved.number }));
      }
      await invalidate();
      await navigate({ to: '/accounting/journal/$id', params: { id: saved.id } });
    };
    if (entry) update.mutate({ id: entry.id, data }, { onSuccess: done });
    else create.mutate({ data }, { onSuccess: done });
  };

  const back = entry
    ? ({ to: '/accounting/journal/$id', params: { id: entry.id } } as const)
    : ({ to: '/accounting/journal' } as const);

  return (
    <>
      <Link
        {...back}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {entry ? entry.number : t('accounting.journal.title')}
      </Link>
      <PageHeader
        title={entry ? t('accounting.journal.edit') : t('accounting.journal.new')}
        description={t('accounting.form.hint')}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(save(false))} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('accounting.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t('accounting.description')}</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={300}
                        placeholder={t('accounting.form.descriptionPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{t('accounting.journal.lines')}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lines.fields.length >= 200}
                onClick={addLine}
              >
                <Plus /> {t('accounting.form.addLine')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-muted-foreground hidden gap-2 text-xs font-medium lg:grid lg:grid-cols-12">
                <span className="lg:col-span-4">{t('accounting.account')}</span>
                <span className="lg:col-span-3">{t('accounting.journal.party')}</span>
                <span className="lg:col-span-2">{t('accounting.description')}</span>
                <span className="text-right">{t('accounting.debit')}</span>
                <span className="text-right">{t('accounting.credit')}</span>
              </div>
              {lines.fields.map((field, index) => (
                <LineRow
                  key={field.id}
                  form={form}
                  index={index}
                  accountGroups={accountGroups}
                  partyGroups={partyGroups}
                  canRemove={lines.fields.length > 2}
                  onRemove={() => lines.remove(index)}
                />
              ))}
              <div className="grid gap-2 border-t pt-3 lg:grid-cols-12">
                <span className="text-right text-sm font-medium lg:col-span-9">
                  {t('accounting.total')}
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {formatMoney(totalDebit, currency)}
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {formatMoney(totalCredit, currency)}
                </span>
              </div>
              <p
                className={cn(
                  'text-right text-sm',
                  difference ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {difference
                  ? t('accounting.form.difference', {
                      value: formatMoney(Math.abs(difference), currency),
                    })
                  : t('accounting.form.balanced')}
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link {...back}>{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending && !post.isPending && <Loader2 className="animate-spin" />}
              {t('accounting.form.saveDraft')}
            </Button>
            {can('accounting:approve') && (
              <Button
                type="button"
                disabled={pending || difference !== 0}
                onClick={form.handleSubmit(save(true))}
              >
                {post.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                {t('accounting.form.saveAndPost')}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </>
  );
}

function LineRow({
  form,
  index,
  accountGroups,
  partyGroups,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<FormValues>;
  index: number;
  accountGroups: PickerGroup[];
  partyGroups: PickerGroup[];
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = (field: keyof LineValues) => `lines.${index}.${field}` as const;
  return (
    <div className="bg-muted/30 grid gap-2 rounded-lg border p-2 lg:grid-cols-12 lg:border-0 lg:bg-transparent lg:p-0">
      <FormField
        control={form.control}
        name={name('accountId')}
        render={({ field, fieldState }) => (
          <FormItem className="lg:col-span-4">
            <OptionPicker
              value={field.value}
              onChange={field.onChange}
              groups={accountGroups}
              placeholder={t('accounting.form.pickAccount')}
              invalid={!!fieldState.error}
              ariaLabel={t('accounting.account')}
            />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={name('party')}
        render={({ field }) => (
          <FormItem className="lg:col-span-3">
            <OptionPicker
              value={field.value}
              onChange={field.onChange}
              groups={partyGroups}
              placeholder={t('accounting.form.noParty')}
              clearable
              ariaLabel={t('accounting.journal.party')}
            />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={name('description')}
        render={({ field }) => (
          <FormItem className="lg:col-span-2">
            <FormControl>
              <Input
                maxLength={200}
                placeholder={t('accounting.description')}
                aria-label={t('accounting.description')}
                {...field}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={name('debit')}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                inputMode="decimal"
                className="text-right tabular-nums"
                placeholder={t('accounting.debit')}
                aria-label={t('accounting.debit')}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex items-start gap-1 lg:col-span-2">
        <FormField
          control={form.control}
          name={name('credit')}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormControl>
                <Input
                  inputMode="decimal"
                  className="text-right tabular-nums"
                  placeholder={t('accounting.credit')}
                  aria-label={t('accounting.credit')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          disabled={!canRemove}
          aria-label={t('accounting.form.removeLine')}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
