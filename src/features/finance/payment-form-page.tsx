import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useChequesFindAll,
  usePaymentsCreate,
  usePaymentsOpenInvoices,
} from '@/api/generated/endpoints/finance/finance';
import { usePartnersFindOne } from '@/api/generated/endpoints/partners/partners';
import {
  PaymentMethod,
  type CreatePaymentDto,
  type PaymentDirection,
  type TreasuryAccountType,
} from '@/api/generated/model';
import { PartnerField, type PartnerOption } from '@/features/partners/partner-components';
import { parseDecimal } from '@/features/trade/document-math';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';
import { CurrencyFields, today, toRate, useBaseCurrency } from '@/features/trade/trade-components';
import {
  AccountSelect,
  paymentBase,
  useAccountOptions,
  useInvalidateFinance,
} from './finance-components';

type AllocationMode = 'auto' | 'manual' | 'none';
type Source = 'new' | 'endorse';

const schema = z.object({
  partner: z.custom<PartnerOption | null>().refine((p): boolean => !!p, 'validation.required'),
  paymentDate: v.requiredString(),
  method: z.nativeEnum(PaymentMethod),
  source: z.enum(['new', 'endorse']),
  chequeId: z.string(),
  accountId: z.string(),
  currencyCode: z.string(),
  exchangeRate: z.string(),
  amount: z.string(),
  serialNo: z.string(),
  bankName: z.string(),
  branchName: z.string(),
  drawer: z.string(),
  dueDate: z.string(),
  description: z.string(),
  allocationMode: z.enum(['auto', 'manual', 'none']),
  allocations: z.record(z.string()),
});
type FormValues = z.infer<typeof schema>;

const isPaper = (method: PaymentMethod) => method === 'CHEQUE' || method === 'NOTE';

/** Which account the method needs: cash box, bank, the bank an own cheque is drawn on, or none. */
function accountTypesFor(
  direction: PaymentDirection,
  method: PaymentMethod,
  source: Source,
): TreasuryAccountType[] | null {
  if (method === 'CASH') return ['CASH'];
  if (method === 'BANK') return ['BANK'];
  if (direction === 'OUT' && method === 'CHEQUE' && source === 'new') return ['BANK'];
  return null;
}

export function PaymentFormPage({
  direction,
  partnerId,
}: {
  direction: PaymentDirection;
  partnerId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidateFinance = useInvalidateFinance();
  const base = useBaseCurrency();
  const incoming = direction === 'IN';
  const create = usePaymentsCreate();
  const { data: presetPartner } = usePartnersFindOne(partnerId ?? '', {
    query: { enabled: !!partnerId },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner: null,
      paymentDate: today(),
      method: 'BANK',
      source: 'new',
      chequeId: '',
      accountId: '',
      currencyCode: base,
      exchangeRate: '',
      amount: '',
      serialNo: '',
      bankName: '',
      branchName: '',
      drawer: '',
      dueDate: '',
      description: '',
      allocationMode: 'auto',
      allocations: {},
    },
  });
  const values = useWatch({ control: form.control });
  const method = values.method ?? 'BANK';
  const source: Source = !incoming && isPaper(method) ? (values.source ?? 'new') : 'new';
  const endorsing = source === 'endorse';
  const partner = values.partner ?? null;

  useEffect(() => {
    if (presetPartner && !form.getValues('partner')) {
      form.setValue('partner', presetPartner);
      form.setValue('currencyCode', presetPartner.currencyCode);
    }
  }, [presetPartner, form]);

  const accountTypes = accountTypesFor(direction, method, source);
  const accounts = useAccountOptions({ types: accountTypes ?? undefined });
  const account = accounts.find((a) => a.id === values.accountId);

  const { data: portfolio } = useChequesFindAll(
    {
      direction: 'RECEIVED',
      status: 'PORTFOLIO',
      kind: method === 'NOTE' ? 'NOTE' : 'CHEQUE',
      pageSize: 100,
      sortBy: 'dueDate',
      sortOrder: 'asc',
    },
    { query: { enabled: endorsing } },
  );
  const endorsable = (portfolio?.data ?? []).filter((c) => c.partnerId !== partner?.id);
  const cheque = endorsable.find((c) => c.id === values.chequeId);

  const currency = endorsing
    ? (cheque?.currencyCode ?? '')
    : accountTypes
      ? (account?.currencyCode ?? '')
      : (values.currencyCode ?? base);
  const amount = endorsing ? Number(cheque?.amount ?? 0) : parseDecimal(values.amount ?? '');

  const { data: openInvoices } = usePaymentsOpenInvoices(
    { partnerId: partner?.id ?? '', direction, currencyCode: currency },
    { query: { enabled: !!partner && !!currency } },
  );
  const allocations = useMemo(() => values.allocations ?? {}, [values.allocations]);
  const allocatedTotal = useMemo(
    () =>
      (openInvoices ?? []).reduce(
        (sum, inv) => sum + (parseDecimal(allocations[inv.id] ?? '') || 0),
        0,
      ),
    [openInvoices, allocations],
  );

  // A different method can need a different account type; drop a selection that no longer fits.
  useEffect(() => {
    if (values.accountId && !accounts.some((a) => a.id === values.accountId)) {
      form.setValue('accountId', '');
    }
  }, [accounts, values.accountId, form]);

  const onSubmit = (data: FormValues) => {
    let failed = false;
    const fail = (name: keyof FormValues, message: string) => {
      form.setError(name, { message });
      failed = true;
    };
    if (accountTypes && !data.accountId) fail('accountId', 'validation.required');
    if (endorsing && !data.chequeId) fail('chequeId', 'validation.required');
    if (!endorsing && !(amount > 0)) fail('amount', 'finance.payments.errors.amount');
    if (isPaper(data.method) && !endorsing) {
      if (!data.serialNo.trim()) fail('serialNo', 'validation.required');
      if (!data.dueDate) fail('dueDate', 'validation.required');
    }
    let picked: { invoiceId: string; amount: number }[] | undefined;
    if (data.allocationMode === 'none') picked = [];
    if (data.allocationMode === 'manual') {
      picked = (openInvoices ?? [])
        .map((inv) => ({ invoiceId: inv.id, amount: parseDecimal(data.allocations[inv.id] ?? '') }))
        .filter((a) => a.amount > 0);
      (openInvoices ?? []).forEach((inv) => {
        const value = parseDecimal(data.allocations[inv.id] ?? '');
        if (value > Number(inv.remaining) + 1e-9) {
          fail('allocations', 'finance.payments.errors.remaining');
        }
      });
      if (allocatedTotal > amount + 1e-9)
        fail('allocations', 'finance.payments.errors.allocationsExceed');
    }
    if (failed) return;

    const paper = isPaper(data.method);
    const dto: CreatePaymentDto = {
      direction,
      method: data.method,
      partnerId: data.partner!.id,
      paymentDate: data.paymentDate,
      accountId: accountTypes ? data.accountId : undefined,
      amount: endorsing ? undefined : amount,
      currencyCode: endorsing || accountTypes ? undefined : data.currencyCode,
      exchangeRate: currency !== base ? toRate(data.exchangeRate) : undefined,
      endorseChequeId: endorsing ? data.chequeId : undefined,
      cheque:
        paper && !endorsing
          ? {
              serialNo: data.serialNo.trim(),
              dueDate: data.dueDate,
              bankName: data.bankName.trim() || undefined,
              branchName: data.branchName.trim() || undefined,
              drawer: data.drawer.trim() || undefined,
            }
          : undefined,
      description: data.description.trim() || undefined,
      allocations: picked,
    };
    create.mutate(
      { data: dto },
      {
        onSuccess: async (created) => {
          toast.success(t('finance.payments.created', { number: created.number }));
          await invalidateFinance();
          await navigate({ to: `${paymentBase(direction)}/$id`, params: { id: created.id } });
        },
      },
    );
  };

  const title = incoming ? t('finance.payments.newCollection') : t('finance.payments.newPayment');
  const allocationsError = form.formState.errors.allocations?.message;

  return (
    <>
      <Link
        to={paymentBase(direction)}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />{' '}
        {incoming ? t('finance.payments.collectionsTitle') : t('finance.payments.paymentsTitle')}
      </Link>
      <PageHeader
        title={title}
        description={
          partner ? t('finance.payments.forPartner', { partner: partner.title }) : undefined
        }
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <PartnerField
                  control={form.control}
                  name="partner"
                  label={incoming ? t('finance.payments.customer') : t('finance.payments.supplier')}
                  type={incoming ? 'CUSTOMER' : 'SUPPLIER'}
                  onPicked={(picked) => {
                    form.setValue('allocations', {});
                    form.setValue('chequeId', '');
                    if (!accountTypes) form.setValue('currencyCode', picked.currencyCode);
                  }}
                />
              </div>
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" max={today()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('finance.payments.method')}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue('allocations', {});
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(PaymentMethod).map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`finance.methods.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />

              {!incoming && isPaper(method) && (
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('finance.payments.source')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">{t('finance.payments.newOwnCheque')}</SelectItem>
                          <SelectItem value="endorse">{t('finance.payments.endorse')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              )}

              {accountTypes && (
                <FormField
                  control={form.control}
                  name="accountId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>
                        {method === 'CHEQUE'
                          ? t('finance.payments.drawnOn')
                          : t('finance.payments.account')}
                      </FormLabel>
                      <AccountSelect
                        value={field.value}
                        onChange={field.onChange}
                        accounts={accounts}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {endorsing ? (
                <FormField
                  control={form.control}
                  name="chequeId"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('finance.payments.pickCheque')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('allocations', {});
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue
                              placeholder={
                                endorsable.length
                                  ? t('common.select')
                                  : t('finance.payments.noPortfolio')
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {endorsable.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.number} · {c.serialNo} · {c.partnerTitle} ·{' '}
                              {formatMoney(c.amount, c.currencyCode)} · {formatDate(c.dueDate)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t('finance.payments.amount')}
                        {currency && ` (${currency})`}
                      </FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" className="tabular-nums" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {!accountTypes && !endorsing && (
                <CurrencyFields
                  control={form.control}
                  currencyName="currencyCode"
                  rateName="exchangeRate"
                />
              )}
              {(accountTypes || endorsing) && currency && currency !== base && (
                <FormField
                  control={form.control}
                  name="exchangeRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('trade.exchangeRate', { base })}</FormLabel>
                      <FormControl>
                        <Input
                          inputMode="decimal"
                          placeholder={t('trade.exchangeRateAuto')}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-4">
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} maxLength={500} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {isPaper(method) && !endorsing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('finance.payments.chequeDetails')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="serialNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('finance.payments.serialNo')}</FormLabel>
                      <FormControl>
                        <Input maxLength={40} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('finance.payments.chequeDue')}</FormLabel>
                      <FormControl>
                        <Input type="date" min={values.paymentDate} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {incoming && (
                  <>
                    {method === 'CHEQUE' && (
                      <>
                        <FormField
                          control={form.control}
                          name="bankName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('finance.payments.bankName')}</FormLabel>
                              <FormControl>
                                <Input maxLength={120} {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="branchName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('finance.payments.branchName')}</FormLabel>
                              <FormControl>
                                <Input maxLength={120} {...field} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                    <FormField
                      control={form.control}
                      name="drawer"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>{t('finance.payments.drawer')}</FormLabel>
                          <FormControl>
                            <Input maxLength={160} placeholder={partner?.title} {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{t('finance.payments.allocationMode')}</CardTitle>
              <FormField
                control={form.control}
                name="allocationMode"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => field.onChange(value as AllocationMode)}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['auto', 'manual', 'none'] as const).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {t(`finance.payments.${mode}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              {!partner || !currency ? null : !openInvoices?.length ? (
                <p className="text-muted-foreground text-sm">
                  {t('finance.payments.noOpenInvoices', { currency })}
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('finance.payments.invoice')}</TableHead>
                        <TableHead>{t('finance.payments.invoiceDate')}</TableHead>
                        <TableHead>{t('finance.payments.dueDate')}</TableHead>
                        <TableHead className="text-right">
                          {t('finance.payments.invoiceTotal')}
                        </TableHead>
                        <TableHead className="text-right">
                          {t('finance.payments.remaining')}
                        </TableHead>
                        {values.allocationMode === 'manual' && (
                          <TableHead className="w-40 text-right">
                            {t('finance.payments.allocate')}
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <code className="text-xs">{inv.number}</code>
                          </TableCell>
                          <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                          <TableCell className={cn(inv.overdue && 'text-destructive font-medium')}>
                            {formatDate(inv.dueDate)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(inv.grandTotal, inv.currencyCode)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatMoney(inv.remaining, inv.currencyCode)}
                          </TableCell>
                          {values.allocationMode === 'manual' && (
                            <TableCell className="text-right">
                              <Input
                                inputMode="decimal"
                                className="ml-auto w-32 text-right tabular-nums"
                                placeholder="0"
                                value={allocations[inv.id] ?? ''}
                                onChange={(e) =>
                                  form.setValue(
                                    'allocations',
                                    { ...form.getValues('allocations'), [inv.id]: e.target.value },
                                    { shouldValidate: false },
                                  )
                                }
                              />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {values.allocationMode === 'manual' && !!openInvoices?.length && (
                <div className="flex justify-end gap-6 text-sm tabular-nums">
                  <span>
                    {t('finance.payments.allocated')}:{' '}
                    <strong>{formatMoney(allocatedTotal, currency)}</strong>
                  </span>
                  <span>
                    {t('finance.payments.unallocated')}:{' '}
                    <strong>{formatMoney(Math.max(amount - allocatedTotal, 0), currency)}</strong>
                  </span>
                </div>
              )}
              {allocationsError && (
                <p className="text-destructive text-sm">{t(allocationsError as never)}</p>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link to={paymentBase(direction)}>{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
