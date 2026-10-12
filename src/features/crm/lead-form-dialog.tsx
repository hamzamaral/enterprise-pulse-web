import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getCrmSummaryQueryKey,
  getLeadsFindAllQueryKey,
  getLeadsFindOneQueryKey,
  useLeadsCreate,
  useLeadsUpdate,
} from '@/api/generated/endpoints/crm/crm';
import { LeadSource, type LeadDetailDto, type LeadStatus } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { emptyToNull } from '@/features/hr/hr-components';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { SimpleFormDialog, type FieldConfig } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { useCurrencyOptions, useMemberOptions } from './crm-components';

const WORKING_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED'];

const schema = z.object({
  companyName: z.string().trim().min(2, 'validation.required'),
  contactName: z.string(),
  email: z.union([z.literal(''), z.string().trim().email('validation.email')]),
  phone: z.string(),
  city: z.string(),
  source: z.nativeEnum(LeadSource),
  status: z.string(),
  estimatedValue: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number({ invalid_type_error: 'validation.number' }).min(0).nullable(),
  ),
  currencyCode: v.requiredString(),
  ownerId: v.requiredString(),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: LeadDetailDto;
  onSaved?: (lead: LeadDetailDto) => void;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const base = useBaseCurrency();
  const invalidate = useInvalidate();
  const create = useLeadsCreate();
  const update = useLeadsUpdate();
  const members = useMemberOptions(open);
  const currencies = useCurrencyOptions(open);

  const onSuccess = async (saved: LeadDetailDto) => {
    toast.success(lead ? t('common.saved') : t('crm.leads.created', { number: saved.number }));
    await invalidate(
      getLeadsFindAllQueryKey(),
      getLeadsFindOneQueryKey(saved.id),
      getCrmSummaryQueryKey(),
    );
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const data = {
      companyName: values.companyName,
      contactName: emptyToNull(values.contactName.trim()),
      email: emptyToNull(values.email.trim()),
      phone: emptyToNull(values.phone.trim()),
      city: emptyToNull(values.city.trim()),
      source: values.source,
      estimatedValue: values.estimatedValue,
      currencyCode: values.currencyCode,
      ownerId: values.ownerId,
      notes: emptyToNull(values.notes.trim()),
    };
    if (lead) {
      update.mutate(
        { id: lead.id, data: { ...data, status: values.status as LeadStatus } },
        { onSuccess },
      );
    } else {
      create.mutate({ data }, { onSuccess });
    }
  };

  const fields: FieldConfig<FormValues>[] = [
    { name: 'companyName', label: t('crm.leads.companyName'), wide: true },
    { name: 'contactName', label: t('crm.leads.contactName') },
    { name: 'email', label: t('common.email'), type: 'email' },
    { name: 'phone', label: t('common.phone') },
    { name: 'city', label: t('common.city') },
    {
      name: 'source',
      label: t('crm.leads.source'),
      type: 'select',
      required: true,
      options: Object.values(LeadSource).map((source) => ({
        value: source,
        label: t(`crm.leads.sources.${source}`),
      })),
    },
    {
      name: 'ownerId',
      label: t('crm.owner'),
      type: 'select',
      required: true,
      options: members,
    },
    { name: 'estimatedValue', label: t('crm.leads.estimatedValue'), type: 'number' },
    {
      name: 'currencyCode',
      label: t('trade.currency'),
      type: 'select',
      required: true,
      options: currencies,
    },
  ];
  if (lead) {
    fields.push({
      name: 'status',
      label: t('common.status'),
      type: 'select',
      required: true,
      options: WORKING_STATUSES.map((status) => ({
        value: status,
        label: t(`crm.leads.statuses.${status}`),
      })),
    });
  }
  fields.push({ name: 'notes', label: t('common.notes'), type: 'textarea', wide: true });

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={lead ? `${lead.number} · ${lead.companyName}` : t('crm.leads.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        companyName: lead?.companyName ?? '',
        contactName: lead?.contactName ?? '',
        email: lead?.email ?? '',
        phone: lead?.phone ?? '',
        city: lead?.city ?? '',
        source: lead?.source ?? LeadSource.WEBSITE,
        status: lead?.status ?? 'NEW',
        estimatedValue: lead?.estimatedValue ? Number(lead.estimatedValue) : null,
        currencyCode: lead?.currencyCode ?? base,
        ownerId: lead?.ownerId ?? me?.user.id ?? '',
        notes: lead?.notes ?? '',
      }}
      fields={fields}
      onSubmit={submit}
    />
  );
}
