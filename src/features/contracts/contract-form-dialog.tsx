import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useContractsCreate,
  useContractsUpdate,
  useContractTypesFindAll,
} from '@/api/generated/endpoints/contracts/contracts';
import type { ContractBillingCycle, ContractDetailDto, ContractParty } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { useCurrencyOptions } from '@/features/crm/crm-components';
import { useEmployeeOptions } from '@/features/hr/hr-components';
import { PartnerField, type PartnerOption } from '@/features/partners/partner-components';
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
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import {
  BILLING_CYCLES,
  suggestEnd,
  useContractTypeOptions,
  useInvalidateContracts,
  useOwnerOptions,
} from './contract-components';

/** Opens the form for a known party, e.g. from a partner or employee page. */
export interface ContractPreset {
  party: ContractParty;
  partner?: PartnerOption;
  employeeId?: string;
  employeeName?: string;
}

const toNumber = (value: string) => Number(value.replace(',', '.'));
const isInt = (value: string, min: number, max: number) =>
  /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;

const schema = z
  .object({
    title: z.string().trim().min(3, 'validation.required').max(200),
    typeId: z.string().min(1, 'validation.required'),
    party: z.string(),
    partner: z.custom<PartnerOption | null>(),
    employeeId: z.string(),
    ownerId: z.string().min(1, 'validation.required'),
    startDate: z.string().min(1, 'validation.required'),
    endDate: z.string(),
    signedDate: z.string(),
    amount: z
      .string()
      .trim()
      .refine((value) => !value || toNumber(value) >= 0, 'validation.number'),
    currencyCode: z.string(),
    billingCycle: z.string(),
    autoRenew: z.boolean(),
    renewalMonths: z.string().refine((v) => !v || isInt(v, 1, 120), 'validation.number'),
    noticeDays: z.string().refine((v) => isInt(v, 0, 365), 'validation.number'),
    reminderDays: z.string().refine((v) => isInt(v, 0, 365), 'validation.number'),
    description: z.string().max(5000),
  })
  .superRefine((v, ctx) => {
    if (v.party === 'PARTNER' && !v.partner) {
      ctx.addIssue({ code: 'custom', path: ['partner'], message: 'validation.required' });
    }
    if (v.party === 'EMPLOYEE' && !v.employeeId) {
      ctx.addIssue({ code: 'custom', path: ['employeeId'], message: 'validation.required' });
    }
    if (v.endDate && v.endDate < v.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'contracts.validation.endBeforeStart',
      });
    }
    if (v.autoRenew && !v.endDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'contracts.validation.autoRenewNeedsEnd',
      });
    }
    if (v.autoRenew && !v.renewalMonths) {
      ctx.addIssue({ code: 'custom', path: ['renewalMonths'], message: 'validation.required' });
    }
  });
type FormValues = z.infer<typeof schema>;

export function ContractFormDialog({
  open,
  onOpenChange,
  contract,
  preset,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract?: ContractDetailDto;
  preset?: ContractPreset;
  onSaved?: (contract: ContractDetailDto) => void;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const create = useContractsCreate();
  const update = useContractsUpdate();
  const invalidate = useInvalidateContracts();
  const { data: types } = useContractTypesFindAll({ query: { enabled: open } });
  const typeOptions = useContractTypeOptions(contract?.party ?? preset?.party, contract?.typeId);
  const owners = useOwnerOptions(open);
  const ownerOptions =
    contract && !owners.some((o) => o.value === contract.ownerId)
      ? [{ value: contract.ownerId, label: contract.ownerName }, ...owners]
      : owners;
  const currencies = useCurrencyOptions(open);
  const draft = !contract || contract.status === 'DRAFT';

  const defaults = (): FormValues => ({
    title: contract?.title ?? '',
    typeId: contract?.typeId ?? '',
    party: contract?.party ?? preset?.party ?? '',
    partner:
      contract?.partnerId && contract.partnerCode && contract.partnerTitle
        ? { id: contract.partnerId, code: contract.partnerCode, title: contract.partnerTitle }
        : (preset?.partner ?? null),
    employeeId: contract?.employeeId ?? preset?.employeeId ?? '',
    ownerId: contract?.ownerId ?? me?.user.id ?? '',
    startDate: contract?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: contract?.endDate ?? '',
    signedDate: contract?.signedDate ?? '',
    amount: contract?.amount ? String(Number(contract.amount)) : '',
    currencyCode: contract?.currencyCode ?? 'TRY',
    billingCycle: contract?.billingCycle ?? 'ONE_TIME',
    autoRenew: contract?.autoRenew ?? false,
    renewalMonths: contract?.renewalMonths ? String(contract.renewalMonths) : '',
    noticeDays: String(contract?.noticeDays ?? 30),
    reminderDays: String(contract?.reminderDays ?? 30),
    description: contract?.description ?? '',
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const party = form.watch('party');
  const autoRenew = form.watch('autoRenew');

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** A new type brings its party, notice period and a suggested end date. */
  const onType = (typeId: string) => {
    form.setValue('typeId', typeId, { shouldValidate: true });
    const type = types?.find((x) => x.id === typeId);
    if (!type || contract) return;
    form.setValue('party', type.party);
    form.setValue('noticeDays', String(type.defaultNoticeDays));
    const start = form.getValues('startDate');
    if (type.defaultTermMonths && start && !form.getValues('endDate')) {
      form.setValue('endDate', suggestEnd(start, type.defaultTermMonths));
    }
    if (type.defaultTermMonths && !form.getValues('renewalMonths')) {
      form.setValue('renewalMonths', String(type.defaultTermMonths));
    }
  };

  const onSuccess = async (saved: ContractDetailDto) => {
    toast.success(contract ? t('common.saved') : t('contracts.created', { number: saved.number }));
    await invalidate();
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const common = {
      title: values.title,
      typeId: values.typeId,
      ownerId: values.ownerId,
      signedDate: values.signedDate || null,
      amount: values.amount ? toNumber(values.amount) : null,
      currencyCode: values.currencyCode,
      billingCycle: values.billingCycle as ContractBillingCycle,
      autoRenew: values.autoRenew,
      renewalMonths: values.renewalMonths ? Number(values.renewalMonths) : null,
      noticeDays: Number(values.noticeDays),
      reminderDays: Number(values.reminderDays),
      description: values.description.trim() || null,
    };
    const dates = draft ? { startDate: values.startDate, endDate: values.endDate || null } : {};
    if (contract) {
      update.mutate({ id: contract.id, data: { ...common, ...dates } }, { onSuccess });
    } else {
      create.mutate(
        {
          data: {
            ...common,
            startDate: values.startDate,
            endDate: values.endDate || null,
            partnerId: values.party === 'PARTNER' ? (values.partner?.id ?? null) : null,
            employeeId: values.party === 'EMPLOYEE' ? values.employeeId : null,
          },
        },
        { onSuccess },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {contract ? `${contract.number} · ${contract.title}` : t('contracts.new')}
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
                    <FormLabel>{t('contracts.titleLabel')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="typeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.type')}</FormLabel>
                    <Select value={field.value} onValueChange={onType}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {typeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                            <span className="text-muted-foreground text-xs">
                              {t(`contracts.party.${o.party}`)}
                            </span>
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
                name="ownerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.owner')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ownerOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {party === 'PARTNER' && (
                <div className="sm:col-span-2">
                  <PartnerField
                    control={form.control}
                    name="partner"
                    label={t('contracts.partner')}
                    disabled={!!contract || !!preset?.partner}
                  />
                </div>
              )}
              {party === 'EMPLOYEE' && (
                <EmployeeSelect
                  control={form.control}
                  disabled={!!contract || !!preset?.employeeId}
                  current={contract?.employeeName ?? preset?.employeeName ?? null}
                />
              )}
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={!draft} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.endDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" disabled={!draft} {...field} />
                    </FormControl>
                    <FormDescription>
                      {draft ? t('contracts.endDateHint') : t('contracts.datesLocked')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.amount')}</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="currencyCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('contracts.currency')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(currencies.length ? currencies : [{ value: 'TRY', label: 'TRY' }]).map(
                            (o) => (
                              <SelectItem key={o.value} value={o.value}>
                                {o.label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="billingCycle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('contracts.billingCycle')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BILLING_CYCLES.map((cycle) => (
                            <SelectItem key={cycle} value={cycle}>
                              {t(`contracts.cycle.${cycle}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="signedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.signedDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reminderDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('contracts.reminderDays')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} max={365} {...field} />
                    </FormControl>
                    <FormDescription>{t('contracts.reminderDaysHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="autoRenew"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 sm:col-span-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div>
                      <FormLabel>{t('contracts.autoRenew')}</FormLabel>
                      <FormDescription>{t('contracts.autoRenewHint')}</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
              {autoRenew && (
                <>
                  <FormField
                    control={form.control}
                    name="renewalMonths"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('contracts.renewalMonths')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={120} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="noticeDays"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('contracts.noticeDays')}</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} max={365} {...field} />
                        </FormControl>
                        <FormDescription>{t('contracts.noticeDaysHint')}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
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

function EmployeeSelect({
  control,
  disabled,
  current,
}: {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  disabled: boolean;
  current: string | null;
}) {
  const { t } = useTranslation();
  const employees = useEmployeeOptions();
  return (
    <FormField
      control={control}
      name="employeeId"
      render={({ field }) => {
        const options =
          field.value && current && !employees.some((e) => e.value === field.value)
            ? [{ value: field.value, label: current }, ...employees]
            : employees;
        return (
          <FormItem className="sm:col-span-2">
            <FormLabel>{t('contracts.employee')}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('common.select')} />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
