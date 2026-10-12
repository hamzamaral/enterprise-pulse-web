import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Target } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getCrmSummaryQueryKey,
  getOpportunitiesBoardQueryKey,
  getOpportunitiesFindOneQueryKey,
  useOpportunitiesFindOne,
} from '@/api/generated/endpoints/crm/crm';
import { usePartnersFindOne } from '@/api/generated/endpoints/partners/partners';
import {
  getSalesQuotesFindAllQueryKey,
  useSalesQuotesCreate,
} from '@/api/generated/endpoints/sales/sales';
import { PartnerField, type PartnerOption } from '@/features/partners/partner-components';
import {
  DocumentLinesEditor,
  documentLineSchema,
  emptyDocumentLine,
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
import { CurrencyFields, today, toRate, useBaseCurrency } from '@/features/trade/trade-components';

const schema = z
  .object({
    partner: z.custom<PartnerOption | null>().refine((p): boolean => !!p, 'validation.required'),
    quoteDate: v.requiredString(),
    validUntil: z.string(),
    currencyCode: z.string(),
    exchangeRate: z.string(),
    notes: z.string(),
    lines: z.array(documentLineSchema).min(1),
  })
  .superRefine((values, ctx) => {
    validateDocumentLines(values.lines, ctx);
    if (values.validUntil && values.validUntil < values.quoteDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validUntil'],
        message: 'sales.quotes.errors.validUntil',
      });
    }
  });

type FormValues = z.infer<typeof schema>;

const inDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export function SalesQuoteFormPage({
  partnerId,
  opportunityId,
}: {
  partnerId?: string;
  /** CRM opportunity the quote answers; its customer is fixed. */
  opportunityId?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const base = useBaseCurrency();
  const create = useSalesQuotesCreate();
  const { data: presetPartner } = usePartnersFindOne(partnerId ?? '', {
    query: { enabled: !!partnerId },
  });
  const { data: opportunity } = useOpportunitiesFindOne(opportunityId ?? '', {
    query: { enabled: !!opportunityId },
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      partner: null,
      quoteDate: today(),
      validUntil: inDays(15),
      currencyCode: base,
      exchangeRate: '',
      notes: '',
      lines: [emptyDocumentLine()],
    },
  });

  const partnerPreset = useRef(false);
  useEffect(() => {
    if (!presetPartner || partnerPreset.current) return;
    partnerPreset.current = true;
    form.setValue('partner', presetPartner);
    form.setValue('currencyCode', opportunity?.currencyCode ?? presetPartner.currencyCode);
  }, [presetPartner, opportunity, form]);

  const [currency, lines] = useWatch({ control: form.control, name: ['currencyCode', 'lines'] });
  const totals = documentAmounts(lines.map(toLineInput));

  const onSubmit = (data: FormValues) =>
    create.mutate(
      {
        data: {
          partnerId: data.partner!.id,
          opportunityId: opportunity?.id,
          quoteDate: data.quoteDate,
          validUntil: data.validUntil || undefined,
          currencyCode: data.currencyCode,
          exchangeRate: toRate(data.exchangeRate),
          notes: data.notes.trim() || undefined,
          lines: data.lines.map(toTradeLine),
        },
      },
      {
        onSuccess: async (quote) => {
          toast.success(t('sales.quotes.created', { number: quote.number }));
          await invalidate(
            getSalesQuotesFindAllQueryKey(),
            ...(opportunity
              ? [
                  getOpportunitiesFindOneQueryKey(opportunity.id),
                  getOpportunitiesBoardQueryKey(),
                  getCrmSummaryQueryKey(),
                ]
              : []),
          );
          await navigate({ to: '/sales/quotes/$id', params: { id: quote.id } });
        },
      },
    );

  return (
    <>
      <Link
        to="/sales/quotes"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('sales.quotes.title')}
      </Link>
      <PageHeader title={t('sales.quotes.new')} description={t('sales.quotes.newHint')} />
      {opportunity && (
        <div className="border-primary/30 bg-primary/5 mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
          <Target className="text-primary mt-0.5 size-4 shrink-0" />
          {t('sales.quotes.forOpportunity', {
            number: opportunity.number,
            title: opportunity.title,
          })}
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <PartnerField
                  control={form.control}
                  name="partner"
                  label={t('sales.customer')}
                  type="CUSTOMER"
                  disabled={!!opportunity}
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
                    <FormLabel>{t('sales.quotes.validUntil')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
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

          <DocumentLinesEditor form={form} priceKind="sale" currency={currency} />
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
