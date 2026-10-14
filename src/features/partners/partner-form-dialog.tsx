import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getPartnersFindAllQueryKey,
  getPartnersFindOneQueryKey,
  usePartnersCreate,
  usePartnersUpdate,
} from '@/api/generated/endpoints/partners/partners';
import { useSettingsFindCurrencies } from '@/api/generated/endpoints/settings/settings';
import { PartnerType, type PartnerDto } from '@/api/generated/model';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { parseDecimal } from '@/features/trade/document-math';

const optionalNumber = z
  .string()
  .refine((value) => !value.trim() || parseDecimal(value) >= 0, 'validation.number');

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^([A-Za-z0-9._-]{2,30})?$/, 'validation.code'),
  title: v.requiredString(),
  type: z.nativeEnum(PartnerType),
  taxNumber: z
    .string()
    .trim()
    .regex(/^(\d{10,11})?$/, 'partners.errors.taxNumber'),
  taxOffice: z.string(),
  contactName: z.string(),
  phone: z.string(),
  email: z.string().trim().email('validation.email').or(z.literal('')),
  city: z.string(),
  address: z.string(),
  paymentTermDays: z
    .string()
    .refine((value) => /^\d{1,3}$/.test(value.trim()), 'validation.number'),
  currencyCode: z.string().min(3, 'validation.required'),
  eInvoiceAlias: z
    .string()
    .trim()
    .regex(/^(urn:mail:[^\s@]+@[^\s@]+\.[^\s@]+)?$/, 'partners.errors.eInvoiceAlias'),
  creditLimit: optionalNumber,
  notes: z.string(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const orNull = (value: string) => value.trim() || null;

export function PartnerFormDialog({
  open,
  onOpenChange,
  partner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner: PartnerDto | null;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const create = usePartnersCreate();
  const update = usePartnersUpdate();
  const { data: currencies } = useSettingsFindCurrencies({ query: { enabled: open } });

  const onSubmit = (values: FormValues) => {
    const payload = {
      title: values.title.trim(),
      type: values.type,
      taxNumber: orNull(values.taxNumber),
      taxOffice: orNull(values.taxOffice),
      contactName: orNull(values.contactName),
      phone: orNull(values.phone),
      email: orNull(values.email),
      city: orNull(values.city),
      address: orNull(values.address),
      paymentTermDays: Number(values.paymentTermDays),
      currencyCode: values.currencyCode,
      eInvoiceAlias: orNull(values.eInvoiceAlias),
      creditLimit: values.creditLimit.trim() ? parseDecimal(values.creditLimit) : null,
      notes: orNull(values.notes),
    };
    if (partner) {
      update.mutate(
        { id: partner.id, data: { ...payload, isActive: values.isActive } },
        {
          onSuccess: async () => {
            toast.success(t('common.saved'));
            await invalidate(getPartnersFindAllQueryKey(), getPartnersFindOneQueryKey(partner.id));
            onOpenChange(false);
          },
        },
      );
    } else {
      create.mutate(
        { data: { ...payload, code: values.code.trim() || undefined } },
        {
          onSuccess: async (created) => {
            toast.success(t('partners.created', { code: created.code }));
            await invalidate(getPartnersFindAllQueryKey());
            onOpenChange(false);
            await navigate({ to: '/partners/$id', params: { id: created.id } });
          },
        },
      );
    }
  };

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={partner ? partner.title : t('partners.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        code: partner?.code ?? '',
        title: partner?.title ?? '',
        type: partner?.type ?? PartnerType.CUSTOMER,
        taxNumber: partner?.taxNumber ?? '',
        taxOffice: partner?.taxOffice ?? '',
        contactName: partner?.contactName ?? '',
        phone: partner?.phone ?? '',
        email: partner?.email ?? '',
        city: partner?.city ?? '',
        address: partner?.address ?? '',
        paymentTermDays: String(partner?.paymentTermDays ?? 30),
        currencyCode: partner?.currencyCode ?? 'TRY',
        eInvoiceAlias: partner?.eInvoiceAlias ?? '',
        creditLimit: partner?.creditLimit ?? '',
        notes: partner?.notes ?? '',
        isActive: partner?.isActive ?? true,
      }}
      fields={[
        { name: 'title', label: t('partners.titleField'), wide: true },
        {
          name: 'code',
          label: t('common.code'),
          placeholder: t('partners.codeHint'),
          disabled: !!partner,
        },
        {
          name: 'type',
          label: t('partners.type'),
          type: 'select',
          required: true,
          options: Object.values(PartnerType).map((value) => ({
            value,
            label: t(`partners.types.${value}`),
          })),
        },
        { name: 'taxNumber', label: t('partners.taxNumber') },
        { name: 'taxOffice', label: t('partners.taxOffice') },
        { name: 'contactName', label: t('partners.contactName') },
        { name: 'phone', label: t('common.phone') },
        { name: 'email', label: t('common.email'), type: 'email' },
        { name: 'city', label: t('common.city') },
        { name: 'address', label: t('common.address'), type: 'textarea', wide: true },
        { name: 'paymentTermDays', label: t('partners.paymentTermDays'), type: 'number' },
        {
          name: 'currencyCode',
          label: t('partners.currency'),
          type: 'select',
          required: true,
          options: (currencies ?? [])
            .filter((c) => c.isActive)
            .map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })),
        },
        {
          name: 'creditLimit',
          label: t('partners.creditLimit'),
          placeholder: t('partners.unlimited'),
        },
        {
          name: 'eInvoiceAlias',
          label: t('partners.eInvoiceAlias'),
          placeholder: 'urn:mail:defaultpk@firma.com.tr',
          wide: true,
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
        ...(partner
          ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
          : []),
      ]}
      onSubmit={onSubmit}
    />
  );
}
