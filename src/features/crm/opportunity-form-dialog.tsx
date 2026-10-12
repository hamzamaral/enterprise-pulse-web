import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getCrmSummaryQueryKey,
  getOpportunitiesBoardQueryKey,
  getOpportunitiesFindAllQueryKey,
  getOpportunitiesFindOneQueryKey,
  useOpportunitiesCreate,
  useOpportunitiesUpdate,
} from '@/api/generated/endpoints/crm/crm';
import type { OpportunityDetailDto, OpportunityStage } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { PartnerField, type PartnerOption } from '@/features/partners/partner-components';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { OPEN_STAGES, useCurrencyOptions, useMemberOptions } from './crm-components';

const DEFAULT_PROBABILITY: Record<string, number> = {
  PROSPECTING: 10,
  QUALIFICATION: 25,
  PROPOSAL: 50,
  NEGOTIATION: 75,
};

const number = (min: number, max?: number) =>
  z
    .string()
    .trim()
    .min(1, 'validation.required')
    .refine((value) => {
      const n = Number(value.replace(',', '.'));
      return Number.isFinite(n) && n >= min && (max === undefined || n <= max);
    }, 'validation.number');

const schema = z.object({
  title: z.string().trim().min(2, 'validation.required'),
  partner: z.custom<PartnerOption | null>().refine((p): boolean => !!p, 'validation.required'),
  amount: number(0),
  currencyCode: z.string().min(1, 'validation.required'),
  stage: z.string(),
  probability: number(0, 100),
  expectedCloseDate: z.string(),
  ownerId: z.string().min(1, 'validation.required'),
  description: z.string(),
});
type FormValues = z.infer<typeof schema>;

const toNumber = (value: string) => Number(value.replace(',', '.'));

/** Creates an opportunity (optionally for a preset customer) or edits an open one. */
export function OpportunityFormDialog({
  open,
  onOpenChange,
  opportunity,
  partner,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: OpportunityDetailDto;
  partner?: PartnerOption;
  onSaved?: (opportunity: OpportunityDetailDto) => void;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const base = useBaseCurrency();
  const create = useOpportunitiesCreate();
  const update = useOpportunitiesUpdate();
  const members = useMemberOptions(open);
  const currencies = useCurrencyOptions(open);
  const invalidate = useInvalidate();

  const defaults = (): FormValues => ({
    title: opportunity?.title ?? '',
    partner: opportunity
      ? {
          id: opportunity.partnerId,
          code: opportunity.partnerCode,
          title: opportunity.partnerTitle,
        }
      : (partner ?? null),
    amount: opportunity ? String(Number(opportunity.amount)) : '',
    currencyCode: opportunity?.currencyCode ?? partner?.currencyCode ?? base,
    stage: opportunity?.stage ?? 'PROSPECTING',
    probability: String(opportunity?.probability ?? DEFAULT_PROBABILITY.PROSPECTING),
    expectedCloseDate: opportunity?.expectedCloseDate ?? '',
    ownerId: opportunity?.ownerId ?? me?.user.id ?? '',
    description: opportunity?.description ?? '',
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSuccess = async (saved: OpportunityDetailDto) => {
    toast.success(
      opportunity ? t('common.saved') : t('crm.opportunities.created', { number: saved.number }),
    );
    await invalidate(
      getOpportunitiesFindAllQueryKey(),
      getOpportunitiesBoardQueryKey(),
      getOpportunitiesFindOneQueryKey(saved.id),
      getCrmSummaryQueryKey(),
    );
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const common = {
      title: values.title,
      amount: toNumber(values.amount),
      currencyCode: values.currencyCode,
      probability: Math.round(toNumber(values.probability)),
      expectedCloseDate: values.expectedCloseDate || null,
      ownerId: values.ownerId,
      description: values.description.trim() || null,
    };
    if (opportunity) {
      update.mutate({ id: opportunity.id, data: common }, { onSuccess });
    } else {
      create.mutate(
        {
          data: {
            ...common,
            partnerId: values.partner!.id,
            stage: values.stage as OpportunityStage,
          },
        },
        { onSuccess },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {opportunity
              ? `${opportunity.number} · ${opportunity.title}`
              : t('crm.opportunities.new')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('crm.opportunities.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <PartnerField
                  control={form.control}
                  name="partner"
                  label={t('sales.customer')}
                  type="CUSTOMER"
                  disabled={!!opportunity || !!partner}
                  onPicked={(picked) => form.setValue('currencyCode', picked.currencyCode)}
                />
              </div>
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.amount')}</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="currencyCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('trade.currency')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
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
              {!opportunity && (
                <FormField
                  control={form.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('crm.opportunities.stage')}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue('probability', String(DEFAULT_PROBABILITY[value]));
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OPEN_STAGES.map((stage) => (
                            <SelectItem key={stage} value={stage}>
                              {t(`crm.opportunities.stages.${stage}`)}
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
                name="probability"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.opportunities.probability')} (%)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" {...field} />
                    </FormControl>
                    {opportunity && (
                      <FormDescription>{t('crm.opportunities.probabilityHint')}</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expectedCloseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.opportunities.expectedClose')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('crm.owner')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {members.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
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
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
