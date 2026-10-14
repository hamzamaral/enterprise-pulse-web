import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  useVehiclesAddDocument,
  useVehiclesAddFuel,
  useVehiclesAddReading,
  useVehiclesAddService,
  useVehiclesAssign,
  useVehiclesCreate,
  useVehiclesOptions,
  useVehiclesReturnVehicle,
  useVehiclesUpdate,
} from '@/api/generated/endpoints/fleet/fleet';
import {
  VehicleDocumentType,
  VehicleFuelType,
  VehicleOwnership,
  VehicleServiceType,
  VehicleStatus,
  type VehicleDetailDto,
  type VehicleDto,
} from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { SimpleFormDialog, type FieldConfig } from '@/shared/components/simple-form-dialog';
import { formatDate } from '@/shared/lib/format';
import { formatKm, localToday, useInvalidateFleet, vehicleLabel } from './fleet-components';

const PLATE = /^(0[1-9]|[1-7]\d|8[01])([A-Z]{1,3})(\d{2,4})$/;

const toNumber = (value: unknown) =>
  value === '' || value === null || value === undefined
    ? null
    : Number(String(value).replace(',', '.'));

const optionalNumber = (min: number, max: number, int = true) =>
  z.preprocess(
    toNumber,
    z
      .number({ invalid_type_error: 'validation.number' })
      .refine((n) => !int || Number.isInteger(n), 'validation.number')
      .refine((n) => n >= min && n <= max, 'validation.number')
      .nullable(),
  );
const optionalInt = (min: number, max: number) => optionalNumber(min, max);

const requiredNumber = (min: number, max: number, int = false) =>
  z.preprocess(
    toNumber,
    z
      .number({ invalid_type_error: 'validation.required', required_error: 'validation.required' })
      .refine((n) => !int || Number.isInteger(n), 'validation.number')
      .refine((n) => n >= min && n <= max, 'validation.number'),
  );

const MAX_KM = 9_999_999;

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VehicleDialogProps extends DialogProps {
  vehicle: VehicleDetailDto;
}

const toastAndClose = (message: string, invalidate: () => Promise<void>, close: () => void) => ({
  onSuccess: async () => {
    toast.success(message);
    await invalidate();
    close();
  },
});

// ---------- Vehicle ----------

const vehicleSchema = z.object({
  plate: z
    .string()
    .trim()
    .refine(
      (value) => PLATE.test(value.toUpperCase().replace(/[\s-]/g, '')),
      'fleet.validation.plate',
    ),
  brand: z.string().trim().min(2, 'validation.required').max(50),
  model: z.string().trim().min(1, 'validation.required').max(80),
  modelYear: optionalInt(1950, 2100),
  color: z.string().max(30),
  vin: z.string().max(30),
  fuelType: z.nativeEnum(VehicleFuelType),
  ownership: z.nativeEnum(VehicleOwnership),
  contractEndsOn: z.string(),
  departmentId: z.string(),
  odometer: optionalInt(0, MAX_KM),
  serviceIntervalKm: optionalInt(1000, 100000),
  serviceIntervalMonths: optionalInt(1, 60),
  nextServiceKm: optionalInt(0, MAX_KM),
  nextServiceDate: z.string(),
  status: z.nativeEnum(VehicleStatus),
  notes: z.string().max(1000),
});
type VehicleValues = z.infer<typeof vehicleSchema>;

/** New vehicle, or the edit form of an existing one. */
export function VehicleFormDialog({
  vehicle,
  open,
  onOpenChange,
  onSaved,
}: DialogProps & { vehicle?: VehicleDetailDto; onSaved?: (vehicle: VehicleDetailDto) => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const create = useVehiclesCreate();
  const update = useVehiclesUpdate();
  const { data: options } = useVehiclesOptions({ query: { enabled: open } });
  const editing = !!vehicle;

  const fields: FieldConfig<VehicleValues>[] = [
    { name: 'plate', label: t('fleet.plate'), placeholder: '34 ABC 123' },
    { name: 'brand', label: t('fleet.brand') },
    { name: 'model', label: t('fleet.model') },
    { name: 'modelYear', label: t('fleet.modelYear'), type: 'number' },
    {
      name: 'fuelType',
      label: t('fleet.fuelType'),
      type: 'select',
      required: true,
      options: Object.values(VehicleFuelType).map((value) => ({
        value,
        label: t(`fleet.fuel.${value}`),
      })),
    },
    { name: 'color', label: t('fleet.color') },
    {
      name: 'ownership',
      label: t('fleet.ownershipLabel'),
      type: 'select',
      required: true,
      options: Object.values(VehicleOwnership).map((value) => ({
        value,
        label: t(`fleet.ownership.${value}`),
      })),
    },
    { name: 'contractEndsOn', label: t('fleet.contractEndsOn'), type: 'date' },
    {
      name: 'departmentId',
      label: t('fleet.department'),
      type: 'select',
      options: (options?.departments ?? []).map((d) => ({ value: d.id, label: d.name })),
    },
    { name: 'vin', label: t('fleet.vin') },
    ...(editing
      ? [
          {
            name: 'status',
            label: t('common.status'),
            type: 'select',
            required: true,
            options: Object.values(VehicleStatus).map((value) => ({
              value,
              label: t(`fleet.status.${value}`),
            })),
          } satisfies FieldConfig<VehicleValues>,
        ]
      : [{ name: 'odometer', label: t('fleet.startOdometer'), type: 'number' } as const]),
    { name: 'serviceIntervalKm', label: t('fleet.serviceIntervalKm'), type: 'number' },
    { name: 'serviceIntervalMonths', label: t('fleet.serviceIntervalMonths'), type: 'number' },
    { name: 'nextServiceKm', label: t('fleet.nextServiceKm'), type: 'number' },
    { name: 'nextServiceDate', label: t('fleet.nextServiceDate'), type: 'date' },
    { name: 'notes', label: t('fleet.notes'), type: 'textarea', wide: true },
  ];

  const submit = (values: VehicleValues) => {
    const owned = values.ownership === VehicleOwnership.OWNED;
    const data = {
      plate: values.plate,
      brand: values.brand,
      model: values.model,
      modelYear: values.modelYear,
      color: emptyToNull(values.color.trim()),
      vin: emptyToNull(values.vin.trim()),
      fuelType: values.fuelType,
      ownership: values.ownership,
      contractEndsOn: owned ? null : emptyToNull(values.contractEndsOn),
      departmentId: emptyToNull(values.departmentId),
      serviceIntervalKm: values.serviceIntervalKm,
      serviceIntervalMonths: values.serviceIntervalMonths,
      notes: emptyToNull(values.notes.trim()),
    };
    if (vehicle) {
      update.mutate(
        {
          id: vehicle.id,
          data: {
            ...data,
            nextServiceKm: values.nextServiceKm,
            nextServiceDate: emptyToNull(values.nextServiceDate),
            status: values.status,
          },
        },
        toastAndClose(t('common.saved'), invalidate, () => onOpenChange(false)),
      );
      return;
    }
    create.mutate(
      {
        data: {
          ...data,
          odometer: values.odometer ?? undefined,
          nextServiceKm: values.nextServiceKm ?? undefined,
          nextServiceDate: values.nextServiceDate || undefined,
        },
      },
      {
        onSuccess: async (created) => {
          toast.success(t('fleet.created'));
          await invalidate();
          onOpenChange(false);
          onSaved?.(created);
        },
      },
    );
  };

  return (
    <SimpleFormDialog<VehicleValues>
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('fleet.editTitle') : t('fleet.new')}
      description={
        <p className="text-muted-foreground text-sm">
          {editing ? t('fleet.editHint') : t('fleet.createHint')}
        </p>
      }
      schema={vehicleSchema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        plate: vehicle?.plate ?? '',
        brand: vehicle?.brand ?? '',
        model: vehicle?.model ?? '',
        modelYear: vehicle?.modelYear ?? null,
        color: vehicle?.color ?? '',
        vin: vehicle?.vin ?? '',
        fuelType: vehicle?.fuelType ?? VehicleFuelType.DIESEL,
        ownership: vehicle?.ownership ?? VehicleOwnership.OWNED,
        contractEndsOn: vehicle?.contractEndsOn ?? '',
        departmentId: vehicle?.departmentId ?? '',
        odometer: null,
        serviceIntervalKm: vehicle ? vehicle.serviceIntervalKm : 15000,
        serviceIntervalMonths: vehicle ? vehicle.serviceIntervalMonths : 12,
        nextServiceKm: vehicle?.nextServiceKm ?? null,
        nextServiceDate: vehicle?.nextServiceDate ?? '',
        status: vehicle?.status ?? VehicleStatus.ACTIVE,
        notes: vehicle?.notes ?? '',
      }}
      fields={fields}
      onSubmit={submit}
    />
  );
}

// ---------- Handover ----------

const assignSchema = z.object({
  employeeId: z.string().min(1, 'validation.required'),
  startDate: z.string().min(1, 'validation.required'),
  odometer: optionalInt(0, MAX_KM),
  note: z.string().max(500),
});
type AssignValues = z.infer<typeof assignSchema>;

export function AssignDialog({ vehicle, open, onOpenChange }: VehicleDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const assign = useVehiclesAssign();
  const { data: options } = useVehiclesOptions({ query: { enabled: open } });
  const drivers = (options?.drivers ?? []).filter((d) => d.id !== vehicle.driver?.employeeId);
  return (
    <SimpleFormDialog<AssignValues>
      open={open}
      onOpenChange={onOpenChange}
      title={vehicle.driver ? t('fleet.handoverTitle') : t('fleet.assignTitle')}
      description={
        <p className="text-muted-foreground text-sm">
          {vehicle.driver
            ? t('fleet.handoverHint', { name: vehicle.driver.name })
            : t('fleet.assignHint')}{' '}
          {t('fleet.odometerHint', { km: formatKm(vehicle.odometer) })}
        </p>
      }
      schema={assignSchema}
      pending={assign.isPending}
      defaultValues={{ employeeId: '', startDate: localToday(), odometer: null, note: '' }}
      fields={[
        {
          name: 'employeeId',
          label: t('fleet.driver'),
          type: 'select',
          required: true,
          wide: true,
          placeholder: t('common.select'),
          options: drivers.map((d) => ({
            value: d.id,
            label: [
              d.name,
              d.departmentName,
              d.currentPlate && t('fleet.drives', { plate: d.currentPlate }),
            ]
              .filter(Boolean)
              .join(' · '),
          })),
        },
        { name: 'startDate', label: t('fleet.handoverDate'), type: 'date' },
        { name: 'odometer', label: t('fleet.odometer'), type: 'number' },
        { name: 'note', label: t('fleet.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        assign.mutate(
          {
            id: vehicle.id,
            data: {
              employeeId: values.employeeId,
              startDate: values.startDate,
              odometer: values.odometer ?? undefined,
              note: emptyToNull(values.note.trim()),
            },
          },
          toastAndClose(t('fleet.assigned'), invalidate, () => onOpenChange(false)),
        )
      }
    />
  );
}

const returnSchema = z.object({
  endDate: z.string().min(1, 'validation.required'),
  odometer: optionalInt(0, MAX_KM),
  note: z.string().max(500),
});
type ReturnValues = z.infer<typeof returnSchema>;

export function ReturnDialog({ vehicle, open, onOpenChange }: VehicleDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const giveBack = useVehiclesReturnVehicle();
  return (
    <SimpleFormDialog<ReturnValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('fleet.returnTitle')}
      description={
        <p className="text-muted-foreground text-sm">
          {t('fleet.returnHint', {
            name: vehicle.driver?.name,
            date: formatDate(vehicle.driver?.since),
          })}{' '}
          {t('fleet.odometerHint', { km: formatKm(vehicle.odometer) })}
        </p>
      }
      schema={returnSchema}
      pending={giveBack.isPending}
      defaultValues={{ endDate: localToday(), odometer: null, note: '' }}
      fields={[
        { name: 'endDate', label: t('fleet.returnDate'), type: 'date' },
        { name: 'odometer', label: t('fleet.odometer'), type: 'number' },
        { name: 'note', label: t('fleet.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        giveBack.mutate(
          {
            id: vehicle.id,
            data: {
              endDate: values.endDate,
              odometer: values.odometer ?? undefined,
              note: emptyToNull(values.note.trim()),
            },
          },
          toastAndClose(t('fleet.returned'), invalidate, () => onOpenChange(false)),
        )
      }
    />
  );
}

// ---------- Fuel and odometer ----------

const fuelSchema = z.object({
  entryDate: z.string().min(1, 'validation.required'),
  odometer: requiredNumber(0, MAX_KM, true),
  liters: requiredNumber(0.1, 2000),
  amount: requiredNumber(0, 1000000),
  fullTank: z.boolean(),
  station: z.string().max(100),
  note: z.string().max(300),
});
type FuelValues = z.infer<typeof fuelSchema>;

/** Fuel purchase by a fleet manager or the driver. */
export function FuelDialog({ vehicle, open, onOpenChange }: DialogProps & { vehicle: VehicleDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const add = useVehiclesAddFuel();
  return (
    <SimpleFormDialog<FuelValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('fleet.fuelTitle', { plate: vehicle.plate })}
      description={
        <p className="text-muted-foreground text-sm">
          {vehicleLabel(vehicle)} · {t('fleet.odometerHint', { km: formatKm(vehicle.odometer) })}{' '}
          {t('fleet.fullTankHint')}
        </p>
      }
      schema={fuelSchema}
      pending={add.isPending}
      defaultValues={{
        entryDate: localToday(),
        odometer: undefined,
        liters: undefined,
        amount: undefined,
        fullTank: true,
        station: '',
        note: '',
      }}
      fields={[
        { name: 'entryDate', label: t('fleet.date'), type: 'date' },
        { name: 'odometer', label: t('fleet.odometer'), type: 'number' },
        { name: 'liters', label: t('fleet.liters'), type: 'number' },
        { name: 'amount', label: t('fleet.amount'), type: 'number' },
        { name: 'station', label: t('fleet.station') },
        { name: 'fullTank', label: t('fleet.fullTank'), type: 'switch' },
        { name: 'note', label: t('fleet.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        add.mutate(
          {
            id: vehicle.id,
            data: {
              entryDate: values.entryDate,
              odometer: values.odometer,
              liters: values.liters,
              amount: values.amount,
              fullTank: values.fullTank,
              station: emptyToNull(values.station.trim()),
              note: emptyToNull(values.note.trim()),
            },
          },
          toastAndClose(t('fleet.fuelAdded'), invalidate, () => onOpenChange(false)),
        )
      }
    />
  );
}

const readingSchema = z.object({
  readingDate: z.string().min(1, 'validation.required'),
  odometer: requiredNumber(0, MAX_KM, true),
  note: z.string().max(300),
});
type ReadingValues = z.infer<typeof readingSchema>;

export function ReadingDialog({
  vehicle,
  open,
  onOpenChange,
}: DialogProps & { vehicle: VehicleDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const add = useVehiclesAddReading();
  return (
    <SimpleFormDialog<ReadingValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('fleet.readingTitle', { plate: vehicle.plate })}
      description={
        <p className="text-muted-foreground text-sm">
          {t('fleet.odometerHint', { km: formatKm(vehicle.odometer) })}
        </p>
      }
      schema={readingSchema}
      pending={add.isPending}
      defaultValues={{ readingDate: localToday(), odometer: undefined, note: '' }}
      fields={[
        { name: 'readingDate', label: t('fleet.date'), type: 'date' },
        { name: 'odometer', label: t('fleet.odometer'), type: 'number' },
        { name: 'note', label: t('fleet.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        add.mutate(
          {
            id: vehicle.id,
            data: {
              readingDate: values.readingDate,
              odometer: values.odometer,
              note: emptyToNull(values.note.trim()),
            },
          },
          toastAndClose(t('fleet.readingAdded'), invalidate, () => onOpenChange(false)),
        )
      }
    />
  );
}

// ---------- Services and documents ----------

const serviceSchema = z.object({
  type: z.nativeEnum(VehicleServiceType),
  serviceDate: z.string().min(1, 'validation.required'),
  odometer: optionalInt(0, MAX_KM),
  partnerId: z.string(),
  description: z.string().trim().min(3, 'validation.required').max(500),
  cost: requiredNumber(0, 100000000),
  nextServiceKm: optionalInt(0, MAX_KM),
  nextServiceDate: z.string(),
});
type ServiceValues = z.infer<typeof serviceSchema>;

export function ServiceDialog({ vehicle, open, onOpenChange }: VehicleDialogProps) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const add = useVehiclesAddService();
  const { data: options } = useVehiclesOptions({ query: { enabled: open } });
  return (
    <SimpleFormDialog<ServiceValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('fleet.serviceTitle')}
      description={
        <p className="text-muted-foreground text-sm">
          {t('fleet.serviceHint', {
            km: vehicle.serviceIntervalKm ? formatKm(vehicle.serviceIntervalKm) : '—',
            months: vehicle.serviceIntervalMonths ?? '—',
          })}
        </p>
      }
      schema={serviceSchema}
      pending={add.isPending}
      defaultValues={{
        type: VehicleServiceType.PERIODIC,
        serviceDate: localToday(),
        odometer: null,
        partnerId: '',
        description: '',
        cost: undefined,
        nextServiceKm: null,
        nextServiceDate: '',
      }}
      fields={[
        {
          name: 'type',
          label: t('fleet.serviceType'),
          type: 'select',
          required: true,
          options: Object.values(VehicleServiceType).map((value) => ({
            value,
            label: t(`fleet.serviceTypes.${value}`),
          })),
        },
        { name: 'serviceDate', label: t('fleet.date'), type: 'date' },
        { name: 'odometer', label: t('fleet.odometer'), type: 'number' },
        { name: 'cost', label: t('fleet.cost'), type: 'number' },
        {
          name: 'partnerId',
          label: t('fleet.workshop'),
          type: 'select',
          wide: true,
          options: (options?.partners ?? []).map((p) => ({ value: p.id, label: p.name })),
        },
        { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
        { name: 'nextServiceKm', label: t('fleet.nextServiceKmOverride'), type: 'number' },
        { name: 'nextServiceDate', label: t('fleet.nextServiceDateOverride'), type: 'date' },
      ]}
      onSubmit={(values) =>
        add.mutate(
          {
            id: vehicle.id,
            data: {
              type: values.type,
              serviceDate: values.serviceDate,
              odometer: values.odometer,
              partnerId: emptyToNull(values.partnerId),
              description: values.description,
              cost: values.cost,
              nextServiceKm: values.nextServiceKm ?? undefined,
              nextServiceDate: values.nextServiceDate || undefined,
            },
          },
          toastAndClose(t('fleet.serviceAdded'), invalidate, () => onOpenChange(false)),
        )
      }
    />
  );
}

const documentSchema = z
  .object({
    type: z.nativeEnum(VehicleDocumentType),
    startDate: z.string(),
    endDate: z.string().min(1, 'validation.required'),
    provider: z.string().max(100),
    policyNumber: z.string().max(50),
    cost: optionalNumber(0, 100000000, false),
    note: z.string().max(500),
  })
  .refine((v) => !v.startDate || v.startDate <= v.endDate, {
    path: ['endDate'],
    message: 'validation.dateRange',
  });
type DocumentValues = z.infer<typeof documentSchema>;

export function DocumentDialog({
  vehicle,
  open,
  onOpenChange,
  type,
}: VehicleDialogProps & { type?: VehicleDocumentType }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const add = useVehiclesAddDocument();
  return (
    <SimpleFormDialog<DocumentValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('fleet.documentTitle')}
      description={<p className="text-muted-foreground text-sm">{t('fleet.documentHint')}</p>}
      schema={documentSchema}
      pending={add.isPending}
      defaultValues={{
        type: type ?? VehicleDocumentType.INSPECTION,
        startDate: localToday(),
        endDate: '',
        provider: '',
        policyNumber: '',
        cost: null,
        note: '',
      }}
      fields={[
        {
          name: 'type',
          label: t('fleet.documentType'),
          type: 'select',
          required: true,
          wide: true,
          options: Object.values(VehicleDocumentType).map((value) => ({
            value,
            label: t(`fleet.documentTypes.${value}`),
          })),
        },
        { name: 'startDate', label: t('fleet.startDate'), type: 'date' },
        { name: 'endDate', label: t('fleet.endDate'), type: 'date' },
        { name: 'provider', label: t('fleet.provider') },
        { name: 'policyNumber', label: t('fleet.policyNumber') },
        { name: 'cost', label: t('fleet.cost'), type: 'number' },
        { name: 'note', label: t('fleet.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        add.mutate(
          {
            id: vehicle.id,
            data: {
              type: values.type,
              startDate: emptyToNull(values.startDate),
              endDate: values.endDate,
              provider: emptyToNull(values.provider.trim()),
              policyNumber: emptyToNull(values.policyNumber.trim()),
              cost: values.cost ?? undefined,
              note: emptyToNull(values.note.trim()),
            },
          },
          toastAndClose(t('fleet.documentAdded'), invalidate, () => onOpenChange(false)),
        )
      }
    />
  );
}
