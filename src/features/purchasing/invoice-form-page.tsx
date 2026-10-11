import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { getPartnersFindAllQueryKey } from '@/api/generated/endpoints/partners/partners';
import {
  getPurchaseInvoicesFindAllQueryKey,
  getPurchaseOrdersFindAllQueryKey,
  getPurchaseOrdersFindOneQueryKey,
  usePurchaseInvoicesCreate,
  usePurchaseOrdersFindOne,
} from '@/api/generated/endpoints/purchasing/purchasing';
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
import { openToInvoice } from './order-detail-page';
import { CurrencyFields, today, toRate, useBaseCurrency } from '@/features/trade/trade-components';

const schema = z
  .object({
    partner: z.custom<PartnerOption | null>().refine((p): boolean => !!p, 'validation.required'),
    supplierInvoiceNo: v.requiredString(),
    invoiceDate: v.requiredString(),
    dueDate: z.string(),
    currencyCode: z.string(),
    exchangeRate: z.string(),
    notes: z.string(),
    lines: z.array(documentLineSchema).min(1),
  })
  .superRefine((values, ctx) => {
    validateDocumentLines(values.lines, ctx);
    if (values.dueDate && values.dueDate < values.invoiceDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dueDate'],
        message: 'purchasing.invoices.errors.dueDate',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

export function InvoiceFormPage({ orderId }: { orderId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const base = useBaseCurrency();
  const create = usePurchaseInvoicesCreate();
  const { data: order } = usePurchaseOrdersFindOne(orderId ?? '', {
    query: { enabled: !!orderId },
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner: null,
      supplierInvoiceNo: '',
      invoiceDate: today(),
      dueDate: '',
      currencyCode: base,
      exchangeRate: '',
      notes: '',
      lines: orderId ? [] : [emptyDocumentLine()],
    },
  });

  const prefilled = useRef(false);
  useEffect(() => {
    if (!order || prefilled.current) return;
    prefilled.current = true;
    form.setValue('partner', {
      id: order.partnerId,
      code: order.partnerCode,
      title: order.partnerTitle,
    });
    form.setValue('currencyCode', order.currencyCode);
    if (order.currencyCode !== base)
      form.setValue('exchangeRate', String(Number(order.exchangeRate)));
    form.setValue(
      'lines',
      order.lines
        .filter((line) => openToInvoice(line) > 0)
        .map((line) => ({
          ...emptyDocumentLine(),
          item: itemFromLine(line),
          description: line.description,
          quantity: String(openToInvoice(line)),
          maxQuantity: openToInvoice(line),
          unitPrice: String(Number(line.unitPrice)),
          discountRate: String(Number(line.discountRate)),
          vatRate: String(Number(line.vatRate)),
          sourceLineId: line.id,
          unitCode: line.unitCode ?? undefined,
        })),
    );
  }, [order, form, base]);

  const [currency, lines] = useWatch({ control: form.control, name: ['currencyCode', 'lines'] });
  const totals = documentAmounts(lines.map(toLineInput));

  const onSubmit = (data: FormValues) => {
    create.mutate(
      {
        data: {
          partnerId: data.partner!.id,
          orderId,
          supplierInvoiceNo: data.supplierInvoiceNo.trim(),
          invoiceDate: data.invoiceDate,
          dueDate: data.dueDate || undefined,
          currencyCode: data.currencyCode,
          exchangeRate: toRate(data.exchangeRate),
          notes: data.notes.trim() || undefined,
          lines: data.lines.map((line) => ({
            ...toTradeLine(line),
            orderLineId: line.sourceLineId,
          })),
        },
      },
      {
        onSuccess: async (invoice) => {
          toast.success(t('purchasing.invoices.created', { number: invoice.number }));
          await invalidate(
            getPurchaseInvoicesFindAllQueryKey(),
            getPurchaseOrdersFindAllQueryKey(),
            getPartnersFindAllQueryKey(),
            ...(orderId ? [getPurchaseOrdersFindOneQueryKey(orderId)] : []),
          );
          await navigate({ to: '/purchasing/invoices/$id', params: { id: invoice.id } });
        },
      },
    );
  };

  return (
    <>
      <Link
        to="/purchasing/invoices"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('purchasing.invoices.title')}
      </Link>
      <PageHeader
        title={t('purchasing.invoices.new')}
        description={
          order
            ? t('purchasing.invoices.forOrder', { number: order.number })
            : t('purchasing.invoices.newHint')
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
                  label={t('purchasing.supplier')}
                  type="SUPPLIER"
                  disabled={!!orderId}
                  onPicked={(partner) => form.setValue('currencyCode', partner.currencyCode)}
                />
              </div>
              <FormField
                control={form.control}
                name="supplierInvoiceNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.invoices.supplierInvoiceNo')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.invoices.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
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
                    <FormLabel>{t('purchasing.invoices.dueDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">
                      {t('purchasing.invoices.dueDateHint')}
                    </p>
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
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('common.notes')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {orderId && !order ? (
            <Loader2 className="text-muted-foreground animate-spin" />
          ) : order && !order.lines.some((line) => openToInvoice(line) > 0) ? (
            <Card>
              <CardContent className="text-muted-foreground pt-6 text-sm">
                {t('purchasing.invoices.nothingToInvoice')}
              </CardContent>
            </Card>
          ) : (
            <DocumentLinesEditor
              form={form}
              priceKind="purchase"
              currency={currency}
              fixedItems={!!orderId}
            />
          )}
          <Card>
            <CardContent className="pt-6">
              <DocumentTotals totals={totals} currency={currency} />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={create.isPending || !lines.length}>
              {create.isPending && <Loader2 className="animate-spin" />}
              {t('purchasing.invoices.post')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
