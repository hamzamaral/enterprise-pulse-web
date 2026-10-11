import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAssetsFindAllQueryKey,
  getAssetsFindOneQueryKey,
  useAssetsCreate,
  useAssetsUpdate,
} from '@/api/generated/endpoints/assets/assets';
import { AssetCondition, type AssetDetailDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { useCategoryOptions, useLocationOptions } from './asset-components';

const optionalAmount = () =>
  z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number({ invalid_type_error: 'validation.number' }).min(0).nullable(),
  );

const schema = z.object({
  name: v.requiredString(),
  categoryId: v.requiredString(),
  brand: z.string(),
  model: z.string(),
  serialNumber: z.string(),
  condition: z.nativeEnum(AssetCondition),
  locationId: z.string(),
  purchaseDate: z.string(),
  purchaseCost: optionalAmount(),
  salvageValue: optionalAmount(),
  usefulLifeMonths: optionalAmount(),
  supplier: z.string(),
  invoiceNo: z.string(),
  warrantyEndDate: z.string(),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  asset?: AssetDetailDto;
  onSaved?: (asset: AssetDetailDto) => void;
}

export function AssetFormDialog({ open, onOpenChange, asset, onSaved }: AssetFormDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const create = useAssetsCreate();
  const update = useAssetsUpdate();
  const categoryOptions = useCategoryOptions(open);
  const locationOptions = useLocationOptions(open);

  const onSuccess = async (saved: AssetDetailDto) => {
    toast.success(t('common.saved'));
    await invalidate(getAssetsFindAllQueryKey(), getAssetsFindOneQueryKey(saved.id));
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const data = {
      name: values.name,
      categoryId: values.categoryId,
      brand: emptyToNull(values.brand),
      model: emptyToNull(values.model),
      serialNumber: emptyToNull(values.serialNumber),
      condition: values.condition,
      locationId: emptyToNull(values.locationId),
      purchaseDate: emptyToNull(values.purchaseDate),
      purchaseCost: values.purchaseCost,
      salvageValue: values.salvageValue ?? 0,
      usefulLifeMonths: values.usefulLifeMonths,
      supplier: emptyToNull(values.supplier),
      invoiceNo: emptyToNull(values.invoiceNo),
      warrantyEndDate: emptyToNull(values.warrantyEndDate),
      notes: emptyToNull(values.notes),
    };
    if (asset) update.mutate({ id: asset.id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={asset ? `${asset.assetTag} · ${asset.name}` : t('assets.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        name: asset?.name ?? '',
        categoryId: asset?.categoryId ?? '',
        brand: asset?.brand ?? '',
        model: asset?.model ?? '',
        serialNumber: asset?.serialNumber ?? '',
        condition: asset?.condition ?? AssetCondition.NEW,
        locationId: asset?.locationId ?? '',
        purchaseDate: asset?.purchaseDate ?? '',
        purchaseCost: asset?.purchaseCost ? Number(asset.purchaseCost) : null,
        salvageValue: asset ? Number(asset.salvageValue) : null,
        usefulLifeMonths: asset?.usefulLifeMonths ?? null,
        supplier: asset?.supplier ?? '',
        invoiceNo: asset?.invoiceNo ?? '',
        warrantyEndDate: asset?.warrantyEndDate ?? '',
        notes: asset?.notes ?? '',
      }}
      fields={[
        { name: 'name', label: t('common.name'), placeholder: t('assets.namePlaceholder') },
        {
          name: 'categoryId',
          label: t('assets.category'),
          type: 'select',
          options: categoryOptions,
          required: true,
        },
        { name: 'brand', label: t('assets.brand') },
        { name: 'model', label: t('assets.model') },
        { name: 'serialNumber', label: t('assets.serialNumber') },
        {
          name: 'condition',
          label: t('assets.condition'),
          type: 'select',
          required: true,
          options: Object.values(AssetCondition).map((c) => ({
            value: c,
            label: t(`assets.conditions.${c}`),
          })),
        },
        {
          name: 'locationId',
          label: t('assets.location'),
          type: 'select',
          options: locationOptions,
          disabled: asset?.status === 'ASSIGNED',
        },
        { name: 'purchaseDate', label: t('assets.purchaseDate'), type: 'date' },
        { name: 'purchaseCost', label: t('assets.purchaseCost'), type: 'number' },
        { name: 'salvageValue', label: t('assets.salvageValue'), type: 'number' },
        {
          name: 'usefulLifeMonths',
          label: t('assets.usefulLifeMonths'),
          type: 'number',
          placeholder: t('assets.usefulLifeFromCategory'),
        },
        { name: 'warrantyEndDate', label: t('assets.warrantyEndDate'), type: 'date' },
        { name: 'supplier', label: t('assets.supplier') },
        { name: 'invoiceNo', label: t('assets.invoiceNo') },
        { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
      ]}
      onSubmit={submit}
    />
  );
}
