import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getProductsFindAllQueryKey,
  getProductsFindOneQueryKey,
  useProductsCreate,
  useProductsUpdate,
} from '@/api/generated/endpoints/inventory/inventory';
import {
  useSettingsFindCurrencies,
  useSettingsFindTaxRates,
  useSettingsFindUnits,
} from '@/api/generated/endpoints/settings/settings';
import { ProductType, TrackingType, type ProductDetailDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { SimpleFormDialog, type FieldConfig } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { useProductCategoryOptions } from './inventory-components';

const optionalNumber = () =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number({ invalid_type_error: 'validation.number' }).min(0).nullable(),
  );

const schema = z.object({
  code: v.code(),
  name: v.requiredString(),
  categoryId: z.string(),
  unitId: v.requiredString(),
  type: z.nativeEnum(ProductType),
  trackingType: z.nativeEnum(TrackingType),
  purchasePrice: optionalNumber(),
  salePrice: optionalNumber(),
  currency: z.string(),
  vatRateId: z.string(),
  barcode: z.string(),
  minStock: optionalNumber(),
  description: z.string(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: ProductDetailDto;
  onSaved?: (product: ProductDetailDto) => void;
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: ProductFormDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const create = useProductsCreate();
  const update = useProductsUpdate();
  const categoryOptions = useProductCategoryOptions(open);
  // Loaded up front: the form takes its defaults (unit, VAT) when it opens.
  const { data: units } = useSettingsFindUnits();
  const { data: taxRates } = useSettingsFindTaxRates();
  const { data: currencies } = useSettingsFindCurrencies({ query: { enabled: open } });
  const locked = product?.hasTransactions ?? false;

  const onSuccess = async (saved: ProductDetailDto) => {
    toast.success(t('common.saved'));
    await invalidate(getProductsFindAllQueryKey(), getProductsFindOneQueryKey(saved.id));
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const common = {
      name: values.name,
      categoryId: emptyToNull(values.categoryId),
      unitId: values.unitId,
      type: values.type,
      trackingType: values.type === ProductType.SERVICE ? TrackingType.NONE : values.trackingType,
      purchasePrice: values.purchasePrice,
      salePrice: values.salePrice,
      currency: values.currency,
      vatRateId: emptyToNull(values.vatRateId),
      description: emptyToNull(values.description),
    };
    if (product) {
      update.mutate(
        { id: product.id, data: { ...common, isActive: values.isActive } },
        { onSuccess },
      );
    } else {
      create.mutate(
        {
          data: {
            ...common,
            code: values.code,
            barcode: emptyToNull(values.barcode),
            minStock: values.minStock ?? 0,
          },
        },
        { onSuccess },
      );
    }
  };

  const fields: FieldConfig<FormValues>[] = [
    { name: 'code', label: t('common.code'), placeholder: 'PRD-001', disabled: !!product },
    { name: 'name', label: t('common.name'), placeholder: t('inventory.products.namePlaceholder') },
    {
      name: 'type',
      label: t('inventory.products.type'),
      type: 'select',
      required: true,
      disabled: locked,
      options: Object.values(ProductType).map((type) => ({
        value: type,
        label: t(`inventory.types.${type}`),
      })),
    },
    {
      name: 'trackingType',
      label: t('inventory.products.tracking'),
      type: 'select',
      required: true,
      disabled: locked,
      options: Object.values(TrackingType).map((tracking) => ({
        value: tracking,
        label: t(`inventory.trackingTypes.${tracking}`),
      })),
    },
    {
      name: 'categoryId',
      label: t('inventory.category'),
      type: 'select',
      options: categoryOptions,
    },
    {
      name: 'unitId',
      label: t('inventory.unit'),
      type: 'select',
      required: true,
      options: (units ?? [])
        .filter((u) => u.isActive)
        .map((u) => ({ value: u.id, label: `${u.code} · ${u.name}` })),
    },
    { name: 'purchasePrice', label: t('inventory.products.purchasePrice'), type: 'number' },
    { name: 'salePrice', label: t('inventory.products.salePrice'), type: 'number' },
    {
      name: 'currency',
      label: t('inventory.products.currency'),
      type: 'select',
      required: true,
      options: (currencies ?? [])
        .filter((c) => c.isActive)
        .map((c) => ({ value: c.code, label: c.code })),
    },
    {
      name: 'vatRateId',
      label: t('inventory.products.vatRate'),
      type: 'select',
      options: (taxRates ?? [])
        .filter((r) => r.isActive)
        .map((r) => ({ value: r.id, label: r.name })),
    },
    ...(product
      ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
      : [
          { name: 'barcode' as const, label: t('inventory.barcode') },
          { name: 'minStock' as const, label: t('inventory.minStock'), type: 'number' as const },
        ]),
    { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
  ];

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={product ? `${product.code} · ${product.name}` : t('inventory.products.new')}
      description={locked ? t('inventory.products.lockedHint') : undefined}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        code: product?.code ?? '',
        name: product?.name ?? '',
        categoryId: product?.categoryId ?? '',
        unitId: product?.unitId ?? units?.find((u) => u.code === 'ADET')?.id ?? '',
        type: product?.type ?? ProductType.GOODS,
        trackingType: product?.trackingType ?? TrackingType.NONE,
        purchasePrice: product?.purchasePrice ? Number(product.purchasePrice) : null,
        salePrice: product?.salePrice ? Number(product.salePrice) : null,
        currency: product?.currency ?? 'TRY',
        vatRateId: product?.vatRateId ?? taxRates?.find((r) => r.isDefault)?.id ?? '',
        barcode: '',
        minStock: null,
        description: product?.description ?? '',
        isActive: product?.isActive ?? true,
      }}
      fields={fields}
      onSubmit={submit}
    />
  );
}
