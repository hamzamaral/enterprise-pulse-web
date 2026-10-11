import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getStockFindLevelsQueryKey,
  getStockMovementsFindAllQueryKey,
  getStockSummaryQueryKey,
} from '@/api/generated/endpoints/inventory/inventory';
import { getPartnersFindAllQueryKey } from '@/api/generated/endpoints/partners/partners';
import {
  getSalesInvoicesFindAllQueryKey,
  getSalesInvoicesFindOneQueryKey,
  getSalesReturnsFindAllQueryKey,
  useSalesInvoicesFindAll,
  useSalesInvoicesFindOne,
  useSalesReturnsCreate,
} from '@/api/generated/endpoints/sales/sales';
import type { SalesInvoiceDetailDto, TrackingType } from '@/api/generated/model';
import { useWarehouseOptions } from '@/features/inventory/inventory-components';
import { parseSerials } from '@/features/inventory/movement-form-page';
import { lineAmounts, parseDecimal } from '@/features/trade/document-math';
import { PageHeader } from '@/shared/components/page-header';
import { formatMoney, formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { today } from '@/features/trade/trade-components';
import { openToReturn } from './invoice-detail-page';

const ORDER_WAREHOUSE = 'ORDER';

const lineSchema = z.object({
  invoiceLineId: z.string(),
  include: z.boolean(),
  label: z.string(),
  sku: z.string(),
  unitCode: z.string(),
  stocked: z.boolean(),
  trackingType: z.custom<TrackingType | null>(),
  remaining: z.number(),
  unitPrice: z.string(),
  discountRate: z.string(),
  vatRate: z.string(),
  quantity: z.string(),
  lotNo: z.string(),
  serialText: z.string(),
});

const schema = z
  .object({
    returnDate: v.requiredString(),
    warehouseId: z.string(),
    reason: v.requiredString(),
    lines: z.array(lineSchema),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (!values.lines.some((line) => line.include)) {
      issue(['lines'], 'sales.returns.errors.noLines');
    }
    values.lines.forEach((line, index) => {
      if (!line.include) return;
      const path = (field: string) => ['lines', index, field];
      const serial = line.stocked && line.trackingType === 'SERIAL';
      const quantity = serial ? parseSerials(line.serialText).length : parseDecimal(line.quantity);
      if (serial && !quantity) {
        return issue(path('serialText'), 'inventory.movements.errors.serialsRequired');
      }
      if (!(quantity > 0)) issue(path('quantity'), 'trade.errors.quantity');
      else if (quantity > line.remaining + 1e-9) {
        issue(path(serial ? 'serialText' : 'quantity'), 'trade.errors.maxQuantity');
      }
      if (line.stocked && line.trackingType === 'LOT' && !line.lotNo.trim()) {
        issue(path('lotNo'), 'validation.required');
      }
    });
  });

type FormValues = z.infer<typeof schema>;

const lineQuantity = (line: FormValues['lines'][number]) =>
  line.stocked && line.trackingType === 'SERIAL'
    ? parseSerials(line.serialText).length
    : parseDecimal(line.quantity);

const toLines = (invoice: SalesInvoiceDetailDto): FormValues['lines'] =>
  invoice.lines
    .filter((line) => openToReturn(line) > 0)
    .map((line) => ({
      invoiceLineId: line.id,
      include: false,
      label: line.description,
      sku: line.sku ?? '',
      unitCode: line.unitCode ?? '',
      stocked: !!line.variantId && line.productType !== 'SERVICE',
      trackingType: line.trackingType,
      remaining: openToReturn(line),
      unitPrice: line.unitPrice,
      discountRate: line.discountRate,
      vatRate: line.vatRate,
      quantity: String(openToReturn(line)),
      lotNo: '',
      serialText: '',
    }));

function InvoiceSelect({ onChange }: { onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data } = useSalesInvoicesFindAll({
    status: 'ISSUED',
    pageSize: 100,
    sortBy: 'invoiceDate',
  });
  const invoices = data?.data ?? [];
  return (
    <div className="max-w-xl space-y-2">
      <Label>{t('sales.invoices.single')}</Label>
      <Select onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('sales.returns.selectInvoice')} />
        </SelectTrigger>
        <SelectContent>
          {invoices.map((invoice) => (
            <SelectItem key={invoice.id} value={invoice.id}>
              {invoice.number} · {invoice.partnerTitle} ·{' '}
              {formatMoney(invoice.grandTotal, invoice.currencyCode)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReturnLine({
  control,
  index,
  currency,
}: {
  control: Control<FormValues>;
  index: number;
  currency: string;
}) {
  const { t } = useTranslation();
  const line = useWatch({ control, name: `lines.${index}` });
  const serial = line.stocked && line.trackingType === 'SERIAL';
  const amount = lineAmounts({
    quantity: lineQuantity(line),
    unitPrice: Number(line.unitPrice),
    discountRate: Number(line.discountRate),
    vatRate: Number(line.vatRate),
  });
  return (
    <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="grid items-start gap-3 md:grid-cols-[1.5rem_minmax(0,1fr)_9rem_8rem]">
        <FormField
          control={control}
          name={`lines.${index}.include`}
          render={({ field }) => (
            <Checkbox
              className="mt-2"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-label={line.label}
            />
          )}
        />
        <div className="pt-1 text-sm">
          {line.sku && <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>}
          {line.label}
          <div className="text-muted-foreground text-xs">
            {t('sales.returns.returnable')}: {formatQuantity(line.remaining, line.unitCode)} ·{' '}
            {formatMoney(line.unitPrice, currency)}
            {!line.stocked && ` · ${t('sales.returns.noStock')}`}
          </div>
        </div>
        {serial ? (
          <div className="pt-1.5 text-right text-sm tabular-nums">
            {formatQuantity(lineQuantity(line), line.unitCode)}
          </div>
        ) : (
          <FormField
            control={control}
            name={`lines.${index}.quantity`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    disabled={!line.include}
                    aria-label={t('trade.quantity')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <div className="pt-1.5 text-right text-sm tabular-nums">
          {line.include ? formatMoney(amount.total, currency) : '—'}
        </div>
      </div>
      {line.include && line.stocked && line.trackingType === 'LOT' && (
        <div className="md:pl-9">
          <FormField
            control={control}
            name={`lines.${index}.lotNo`}
            render={({ field }) => (
              <FormItem className="max-w-sm">
                <FormLabel className="text-xs">{t('inventory.movements.lot')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
      {line.include && serial && (
        <div className="md:pl-9">
          <FormField
            control={control}
            name={`lines.${index}.serialText`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t('inventory.movements.serials')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={t('inventory.movements.serialsHint')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

export function SalesReturnFormPage({ invoiceId }: { invoiceId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const create = useSalesReturnsCreate();
  const { data: invoice } = useSalesInvoicesFindOne(invoiceId ?? '', {
    query: { enabled: !!invoiceId },
  });
  const warehouses = useWarehouseOptions();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      returnDate: today(),
      warehouseId: ORDER_WAREHOUSE,
      reason: '',
      lines: [],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const values = useWatch({ control: form.control, name: 'lines' });

  useEffect(() => {
    if (!invoice) return;
    form.setValue('lines', toLines(invoice));
    if (!invoice.orderId) form.setValue('warehouseId', '');
  }, [invoice, form]);

  const total = values
    .filter((line) => line.include)
    .reduce(
      (sum, line) =>
        sum +
        lineAmounts({
          quantity: lineQuantity(line),
          unitPrice: Number(line.unitPrice),
          discountRate: Number(line.discountRate),
          vatRate: Number(line.vatRate),
        }).total,
      0,
    );
  const needsWarehouse = values.some((line) => line.include && line.stocked);

  const onSubmit = (data: FormValues) => {
    if (!invoiceId) return;
    if (needsWarehouse && !data.warehouseId) {
      form.setError('warehouseId', { message: 'validation.required' });
      return;
    }
    create.mutate(
      {
        data: {
          invoiceId,
          returnDate: data.returnDate,
          reason: data.reason.trim(),
          warehouseId:
            data.warehouseId && data.warehouseId !== ORDER_WAREHOUSE ? data.warehouseId : undefined,
          lines: data.lines
            .filter((line) => line.include)
            .map((line) => {
              const serialNos = parseSerials(line.serialText);
              const serial = line.stocked && line.trackingType === 'SERIAL';
              return {
                invoiceLineId: line.invoiceLineId,
                quantity: serial ? serialNos.length : parseDecimal(line.quantity),
                ...(line.stocked && line.trackingType === 'LOT' && { lotNo: line.lotNo.trim() }),
                ...(serial && { serialNos }),
              };
            }),
        },
      },
      {
        onSuccess: async (created) => {
          toast.success(t('sales.returns.created', { number: created.number }));
          await invalidate(
            getSalesReturnsFindAllQueryKey(),
            getSalesInvoicesFindAllQueryKey(),
            getSalesInvoicesFindOneQueryKey(invoiceId),
            getPartnersFindAllQueryKey(),
            getStockMovementsFindAllQueryKey(),
            getStockFindLevelsQueryKey(),
            getStockSummaryQueryKey(),
          );
          await navigate({ to: '/sales/returns/$id', params: { id: created.id } });
        },
      },
    );
  };

  const linesError =
    form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message;

  return (
    <>
      <Link
        to="/sales/returns"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('sales.returns.title')}
      </Link>
      <PageHeader
        title={t('sales.returns.new')}
        description={
          invoice
            ? t('sales.returns.forInvoice', {
                number: invoice.number,
                partner: invoice.partnerTitle,
              })
            : t('sales.returns.newHint')
        }
      />
      {!invoiceId ? (
        <Card>
          <CardContent className="pt-6">
            <InvoiceSelect
              onChange={(id) =>
                void navigate({ to: '/sales/returns/new', search: { invoiceId: id } })
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Card>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('sales.returns.date')}</FormLabel>
                      <FormControl>
                        <Input type="date" min={invoice?.invoiceDate} max={today()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('sales.returns.warehouse')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('common.select')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {invoice?.orderId && (
                            <SelectItem value={ORDER_WAREHOUSE}>
                              {t('sales.returns.orderWarehouse')}
                            </SelectItem>
                          )}
                          {warehouses.map((w) => (
                            <SelectItem key={w.value} value={w.value}>
                              {w.label}
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
                  name="reason"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('sales.returns.reason')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('sales.returns.lines')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!invoice ? (
                  <Loader2 className="text-muted-foreground animate-spin" />
                ) : lines.fields.length ? (
                  lines.fields.map((field, index) => (
                    <ReturnLine
                      key={field.id}
                      control={form.control}
                      index={index}
                      currency={invoice.currencyCode}
                    />
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">{t('sales.returns.nothingLeft')}</p>
                )}
                {linesError && <p className="text-destructive text-sm">{t(linesError as never)}</p>}
                {invoice && total > 0 && (
                  <div className="flex justify-end border-t pt-3 text-sm">
                    <span className="text-muted-foreground mr-4">{t('sales.returns.credit')}</span>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(total, invoice.currencyCode)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending || !lines.fields.length}>
                {create.isPending && <Loader2 className="animate-spin" />}
                {t('sales.returns.post')}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </>
  );
}
