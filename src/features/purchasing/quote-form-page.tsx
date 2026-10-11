import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getPurchaseRequestsComparisonQueryKey,
  getPurchaseRequestsFindOneQueryKey,
  getSupplierQuotesFindAllQueryKey,
  usePurchaseRequestsFindOne,
  useSupplierQuotesCreate,
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
import { CurrencyFields, today, toRate, useBaseCurrency } from './purchasing-components';

const schema = z
  .object({
    partner: z.custom<PartnerOption | null>().refine((p): boolean => !!p, 'validation.required'),
    quoteDate: v.requiredString(),
    validUntil: z.string(),
    deliveryDays: z.string(),
    currencyCode: z.string(),
    exchangeRate: z.string(),
    notes: z.string(),
    lines: z.array(documentLineSchema).min(1),
  })
  .superRefine((values, ctx) => validateDocumentLines(values.lines, ctx));

type FormValues = z.infer<typeof schema>;

export function QuoteFormPage({ requestId }: { requestId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const base = useBaseCurrency();
  const create = useSupplierQuotesCreate();
  const { data: request } = usePurchaseRequestsFindOne(requestId ?? '', {
    query: { enabled: !!requestId },
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner: null,
      quoteDate: today(),
      validUntil: '',
      deliveryDays: '',
      currencyCode: base,
      exchangeRate: '',
      notes: '',
      lines: [emptyDocumentLine()],
    },
  });

  const prefilled = useRef(false);
  useEffect(() => {
    if (!request || prefilled.current) return;
    prefilled.current = true;
    form.setValue(
      'lines',
      request.lines.map((line) => ({
        ...emptyDocumentLine(),
        item: itemFromLine(line),
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.estimatedPrice ?? '',
        sourceLineId: line.id,
        unitCode: line.unitCode ?? undefined,
      })),
    );
  }, [request, form]);

  const [currency, lines] = useWatch({ control: form.control, name: ['currencyCode', 'lines'] });
  const totals = documentAmounts(lines.map(toLineInput));

  const onSubmit = (data: FormValues) => {
    create.mutate(
      {
        data: {
          requestId,
          partnerId: data.partner!.id,
          quoteDate: data.quoteDate,
          validUntil: data.validUntil || undefined,
          deliveryDays: data.deliveryDays ? Number(data.deliveryDays) : undefined,
          currencyCode: data.currencyCode,
          exchangeRate: toRate(data.exchangeRate),
          notes: data.notes.trim() || undefined,
          lines: data.lines.map((line) => ({
            ...toTradeLine(line),
            requestLineId: line.sourceLineId,
          })),
        },
      },
      {
        onSuccess: async (quote) => {
          toast.success(t('purchasing.quotes.created', { number: quote.number }));
          await invalidate(
            getSupplierQuotesFindAllQueryKey(),
            ...(requestId
              ? [
                  getPurchaseRequestsFindOneQueryKey(requestId),
                  getPurchaseRequestsComparisonQueryKey(requestId),
                ]
              : []),
          );
          await navigate(
            requestId
              ? { to: '/purchasing/requests/$id', params: { id: requestId } }
              : { to: '/purchasing/quotes/$id', params: { id: quote.id } },
          );
        },
      },
    );
  };

  return (
    <>
      {requestId ? (
        <Link
          to="/purchasing/requests/$id"
          params={{ id: requestId }}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {request?.number ?? t('purchasing.requests.title')}
        </Link>
      ) : (
        <Link
          to="/purchasing/quotes"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('purchasing.quotes.title')}
        </Link>
      )}
      <PageHeader
        title={t('purchasing.quotes.new')}
        description={
          request
            ? t('purchasing.quotes.forRequest', { number: request.number, title: request.title })
            : t('purchasing.quotes.newHint')
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
                  onPicked={(partner) => form.setValue('currencyCode', partner.currencyCode)}
                />
              </div>
              <FormField
                control={form.control}
                name="quoteDate"
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
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.quotes.validUntil')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="deliveryDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.quotes.deliveryDays')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={365} {...field} />
                    </FormControl>
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
