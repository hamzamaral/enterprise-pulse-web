import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getPurchaseRequestsFindAllQueryKey,
  usePurchaseRequestsCreate,
} from '@/api/generated/endpoints/purchasing/purchasing';
import {
  DocumentLinesEditor,
  documentLineSchema,
  emptyDocumentLine,
  validateDocumentLines,
} from '@/features/trade/document-lines-editor';
import { usePermission } from '@/features/auth/use-session';
import { parseDecimal } from '@/features/trade/document-math';
import { PageHeader } from '@/shared/components/page-header';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';
import { today, useBaseCurrency } from './purchasing-components';

const schema = z
  .object({
    title: v.requiredString().pipe(z.string().min(3, 'validation.required')),
    neededBy: z.string(),
    notes: z.string(),
    lines: z.array(documentLineSchema).min(1),
  })
  .superRefine((values, ctx) => {
    validateDocumentLines(values.lines, ctx, { priced: false });
    values.lines.forEach((line, index) => {
      if (line.unitPrice && !(parseDecimal(line.unitPrice) >= 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lines', index, 'unitPrice'],
          message: 'validation.number',
        });
      }
    });
  });

type FormValues = z.infer<typeof schema>;

export function RequestFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const currency = useBaseCurrency();
  const can = usePermission();
  const canPickItems = can(['inventory:read', 'purchasing:read', 'sales:read']);
  const create = usePurchaseRequestsCreate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      neededBy: '',
      notes: '',
      lines: [{ ...emptyDocumentLine(), unitPrice: '' }],
    },
  });

  const onSubmit = (data: FormValues) => {
    create.mutate(
      {
        data: {
          title: data.title.trim(),
          neededBy: data.neededBy || undefined,
          notes: data.notes.trim() || undefined,
          lines: data.lines.map((line) => ({
            variantId: line.item?.variantId,
            description: line.description.trim() || undefined,
            quantity: parseDecimal(line.quantity),
            estimatedPrice: line.unitPrice ? parseDecimal(line.unitPrice) : undefined,
          })),
        },
      },
      {
        onSuccess: async (request) => {
          toast.success(t('purchasing.requests.created', { number: request.number }));
          await invalidate(getPurchaseRequestsFindAllQueryKey());
          await navigate({ to: '/purchasing/requests/$id', params: { id: request.id } });
        },
      },
    );
  };

  return (
    <>
      <Link
        to="/purchasing/requests"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('purchasing.requests.title')}
      </Link>
      <PageHeader
        title={t('purchasing.requests.new')}
        description={t('purchasing.requests.newHint')}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('purchasing.requests.titleField')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('purchasing.requests.titleHint')} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="neededBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('purchasing.requests.neededBy')}</FormLabel>
                    <FormControl>
                      <Input type="date" min={today()} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t('purchasing.requests.reason')}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <DocumentLinesEditor
            form={form}
            priceKind="purchase"
            currency={currency}
            allowFreeText
            priced={false}
            pickItems={canPickItems}
          />

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/purchasing/requests">{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              {t('purchasing.requests.submit')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
