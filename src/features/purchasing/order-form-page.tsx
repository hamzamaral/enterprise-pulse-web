import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getPurchaseOrdersFindAllQueryKey,
  getPurchaseOrdersFindOneQueryKey,
  usePurchaseOrdersCreate,
  usePurchaseOrdersFindOne,
  usePurchaseOrdersUpdate,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { useWarehouseOptions } from '@/features/inventory/inventory-components';
import { PartnerField, type PartnerOption } from '@/features/partners/partner-components';
import {
  DocumentLinesEditor,
  documentLineSchema,
  emptyDocumentLine,
  itemFromLine,
  toLineInput,
  toTradeLine,
  validateDocumentLines,
} from '@/features/trade/document-lines-editor';
import { documentAmounts } from '@/features/trade/document-math';
import { DocumentTotals } from '@/features/trade/document-totals';
import { PageHeader } from '@/shared/components/page-header';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { CurrencyFields, today, toRate, useBaseCurrency } from '@/features/trade/trade-components';

const schema = z
  .object({
    partner: z.custom<PartnerOption | null>().refine((p): boolean => !!p, 'validation.required'),
    orderDate: v.requiredString(),
    expectedDate: z.string(),
    warehouseId: v.requiredString(),
    currencyCode: z.string(),
    exchangeRate: z.string(),
    notes: z.string(),
    lines: z.array(documentLineSchema).min(1),
  })
  .superRefine((values, ctx) => validateDocumentLines(values.lines, ctx, { requireItem: true }));

type FormValues = z.infer<typeof schema>;

export function OrderFormPage({ orderId }: { orderId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const base = useBaseCurrency();
  const warehouses = useWarehouseOptions();
  const create = usePurchaseOrdersCreate();
  const update = usePurchaseOrdersUpdate();
  const { data: order } = usePurchaseOrdersFindOne(orderId ?? '', {
    query: { enabled: !!orderId },
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner: null,
      orderDate: today(),
      expectedDate: '',
      warehouseId: '',
      currencyCode: base,
      exchangeRate: '',
      notes: '',
      lines: [emptyDocumentLine()],
    },
  });

  const loaded = useRef(false);
  useEffect(() => {
    if (!order || loaded.current) return;
    loaded.current = true;
    form.reset({
      partner: { id: order.partnerId, code: order.partnerCode, title: order.partnerTitle },
      orderDate: order.orderDate,
      expectedDate: order.expectedDate ?? '',
      warehouseId: order.warehouseId,
      currencyCode: order.currencyCode,
      exchangeRate: order.currencyCode === base ? '' : String(Number(order.exchangeRate)),
      notes: order.notes ?? '',
      lines: order.lines.map((line) => ({
        ...emptyDocumentLine(),
        item: itemFromLine(line),
        description: line.description,
        quantity: line.quantity,
        unitPrice: String(Number(line.unitPrice)),
        discountRate: String(Number(line.discountRate)),
        vatRate: String(Number(line.vatRate)),
        sourceLineId: line.requestLineId ?? undefined,
      })),
    });
  }, [order, form, base]);

  const [currency, lines] = useWatch({ control: form.control, name: ['currencyCode', 'lines'] });
  const totals = documentAmounts(lines.map(toLineInput));
  const pending = create.isPending || update.isPending;

  if (orderId && !order) return <Skeleton className="h-96" />;

  const onSubmit = (data: FormValues) => {
    const body = {
      orderDate: data.orderDate,
      expectedDate: data.expectedDate || undefined,
      warehouseId: data.warehouseId,
      currencyCode: data.currencyCode,
      exchangeRate: toRate(data.exchangeRate),
      notes: data.notes.trim() || undefined,
      lines: data.lines.map((line) => ({
        ...toTradeLine(line),
        requestLineId: line.sourceLineId,
      })),
    };
    const done = async (saved: { id: string; number: string }) => {
      toast.success(t('purchasing.orders.saved', { number: saved.number }));
      await invalidate(
        getPurchaseOrdersFindAllQueryKey(),
        getPurchaseOrdersFindOneQueryKey(saved.id),
      );
      await navigate({ to: '/purchasing/orders/$id', params: { id: saved.id } });
    };
    if (orderId) {
      update.mutate({ id: orderId, data: body }, { onSuccess: done });
    } else {
      create.mutate({ data: { ...body, partnerId: data.partner!.id } }, { onSuccess: done });
    }
  };

  return (
    <>
      <Link
        to="/purchasing/orders"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('purchasing.orders.title')}
      </Link>
      <PageHeader
        title={
          order ? t('purchasing.orders.edit', { number: order.number }) : t('purchasing.orders.new')
        }
        description={t('purchasing.orders.newHint')}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <PartnerField
                  control={form.control}
                  name="partner"
                  label={t('purchasing.supplier')}
                  type="SUPPLIER"
                  disabled={!!orderId}
                  onPicked={(partner) => form.setValue('currencyCode', partner.currencyCode)}
                />
              </div>
              <FormField
                control={form.control}
                name="orderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('trade.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.orders.expectedDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="warehouseId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.orders.warehouse')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
              <CurrencyFields
                control={form.control}
                currencyName="currencyCode"
                rateName="exchangeRate"
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-4">
                    <FormLabel>{t('common.notes')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <DocumentLinesEditor form={form} priceKind="purchase" currency={currency} />
          <Card>
            <CardContent className="pt-6">
              <DocumentTotals totals={totals} currency={currency} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t('purchasing.orders.saveDraft')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
