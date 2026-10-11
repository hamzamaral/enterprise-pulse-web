import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ChevronsUpDown, Loader2, Plus, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type UseFormReturn,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getProductsFindAllQueryKey,
  getStockFindLevelsQueryKey,
  getStockMovementsFindAllQueryKey,
  getStockSummaryQueryKey,
  useStockFindLots,
  useStockFindSerials,
  useStockMovementsCreate,
} from '@/api/generated/endpoints/inventory/inventory';
import {
  StockMovementType,
  type MovementLineInputDto,
  type StockItemDto,
} from '@/api/generated/model';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { ItemPicker, useWarehouseOptions } from './inventory-components';

/** Which warehouses each movement type uses: [source, target]. */
const WAREHOUSES: Record<StockMovementType, [boolean, boolean]> = {
  RECEIPT: [false, true],
  ISSUE: [true, false],
  TRANSFER: [true, true],
  ADJUSTMENT: [false, true],
};

type Direction = 'IN' | 'OUT';

const isIncoming = (type: StockMovementType, direction: Direction) =>
  type === 'RECEIPT' || (type === 'ADJUSTMENT' && direction === 'IN');

/** One serial number per line (commas also accepted), duplicates removed. */
export const parseSerials = (text: string) => [
  ...new Set(
    text
      .split(/[\n,;]/)
      .map((s) => s.trim())
      .filter(Boolean),
  ),
];

const lineSchema = z.object({
  item: z.custom<StockItemDto | null>(),
  direction: z.enum(['IN', 'OUT']),
  quantity: z.string(),
  unitCost: z.string(),
  lotNo: z.string(),
  expiryDate: z.string(),
  lotId: z.string(),
  serialText: z.string(),
  serialIds: z.array(z.string()),
});

const schema = z
  .object({
    type: z.nativeEnum(StockMovementType),
    movementDate: v.requiredString(),
    sourceWarehouseId: z.string(),
    targetWarehouseId: z.string(),
    reference: z.string(),
    notes: z.string(),
    lines: z.array(lineSchema).min(1),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    const [needsSource, needsTarget] = WAREHOUSES[values.type];
    if (needsSource && !values.sourceWarehouseId)
      issue(['sourceWarehouseId'], 'validation.required');
    if (needsTarget && !values.targetWarehouseId)
      issue(['targetWarehouseId'], 'validation.required');
    if (
      values.type === 'TRANSFER' &&
      values.sourceWarehouseId &&
      values.sourceWarehouseId === values.targetWarehouseId
    ) {
      issue(['targetWarehouseId'], 'inventory.movements.errors.sameWarehouse');
    }

    values.lines.forEach((line, index) => {
      const path = (field: string) => ['lines', index, field];
      if (!line.item) return issue(path('item'), 'validation.required');
      const incoming = isIncoming(values.type, line.direction);
      if (line.item.trackingType === 'SERIAL') {
        const count = incoming ? parseSerials(line.serialText).length : line.serialIds.length;
        if (!count) {
          issue(
            path(incoming ? 'serialText' : 'serialIds'),
            'inventory.movements.errors.serialsRequired',
          );
        }
        return;
      }
      const quantity = Number(line.quantity.replace(',', '.'));
      if (!(quantity > 0)) issue(path('quantity'), 'inventory.movements.errors.quantity');
      if (line.item.trackingType === 'LOT') {
        if (incoming && !line.lotNo.trim()) issue(path('lotNo'), 'validation.required');
        if (!incoming && !line.lotId) issue(path('lotId'), 'validation.required');
      }
      if (line.unitCost && !(Number(line.unitCost.replace(',', '.')) >= 0)) {
        issue(path('unitCost'), 'validation.number');
      }
    });
  });

type FormValues = z.infer<typeof schema>;
type LineValues = FormValues['lines'][number];

const emptyLine = (): LineValues => ({
  item: null,
  direction: 'IN',
  quantity: '',
  unitCost: '',
  lotNo: '',
  expiryDate: '',
  lotId: '',
  serialText: '',
  serialIds: [],
});

const today = () => new Date().toISOString().slice(0, 10);
const toNumber = (value: string) => Number(value.replace(',', '.'));

function toLineInput(type: StockMovementType, line: LineValues): MovementLineInputDto {
  const item = line.item!;
  const incoming = isIncoming(type, line.direction);
  const serialNos = parseSerials(line.serialText);
  const quantity =
    item.trackingType === 'SERIAL'
      ? incoming
        ? serialNos.length
        : line.serialIds.length
      : toNumber(line.quantity);
  return {
    variantId: item.variantId,
    quantity: type === 'ADJUSTMENT' && line.direction === 'OUT' ? -quantity : quantity,
    unitCost: type === 'RECEIPT' && line.unitCost ? toNumber(line.unitCost) : undefined,
    ...(item.trackingType === 'LOT' &&
      (incoming
        ? { lotNo: line.lotNo.trim(), expiryDate: line.expiryDate || undefined }
        : { lotId: line.lotId })),
    ...(item.trackingType === 'SERIAL' &&
      (incoming ? { serialNos } : { serialIds: line.serialIds })),
  };
}

function LotSelect({
  variantId,
  warehouseId,
  value,
  onChange,
  unit,
}: {
  variantId: string;
  warehouseId: string;
  value: string;
  onChange: (lotId: string) => void;
  unit: string;
}) {
  const { t } = useTranslation();
  const { data } = useStockFindLots(
    { variantId, warehouseId },
    { query: { enabled: !!warehouseId } },
  );
  return (
    <Select value={value} onValueChange={onChange} disabled={!warehouseId}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={t('inventory.movements.selectLot')} />
      </SelectTrigger>
      <SelectContent>
        {(data ?? []).map((lot) => (
          <SelectItem key={lot.lotId} value={lot.lotId}>
            {lot.lotNo}
            {lot.expiryDate &&
              ` · ${t('inventory.movements.expiryShort')} ${formatDate(lot.expiryDate)}`}
            {` · ${formatQuantity(lot.quantity, unit)}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SerialSelect({
  variantId,
  warehouseId,
  value,
  onChange,
}: {
  variantId: string;
  warehouseId: string;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const { t } = useTranslation();
  const { data } = useStockFindSerials(
    { variantId, warehouseId, status: 'IN_STOCK' },
    { query: { enabled: !!warehouseId } },
  );
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={!warehouseId}
          className="w-full justify-between font-normal"
        >
          {value.length
            ? t('inventory.movements.serialsSelected', { count: value.length })
            : t('inventory.movements.selectSerials')}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-64 overflow-y-auto p-2" align="start">
        {data?.length ? (
          data.map((serial) => (
            <label
              key={serial.id}
              className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
            >
              <Checkbox
                checked={value.includes(serial.id)}
                onCheckedChange={() => toggle(serial.id)}
              />
              <code className="text-xs">{serial.serialNo}</code>
            </label>
          ))
        ) : (
          <p className="text-muted-foreground p-2 text-sm">{t('common.noResults')}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function LineRow({
  index,
  form,
  type,
  sourceId,
  targetId,
  onRemove,
}: {
  index: number;
  form: UseFormReturn<FormValues>;
  type: StockMovementType;
  sourceId: string;
  targetId: string;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const control = form.control as Control<FormValues>;
  const line = useWatch({ control, name: `lines.${index}` });
  const item = line.item;
  const incoming = isIncoming(type, line.direction);
  // Outgoing lines take stock from the source (or, for adjustments, the adjusted warehouse).
  const outgoingFrom = type === 'ADJUSTMENT' ? targetId : sourceId;
  const pickerWarehouse = type === 'RECEIPT' || type === 'ADJUSTMENT' ? targetId : sourceId;
  const serialCount = incoming ? parseSerials(line.serialText).length : line.serialIds.length;
  const name = (field: keyof LineValues) => `lines.${index}.${field}` as const;

  const resetTracking = () => {
    form.setValue(name('lotNo'), '');
    form.setValue(name('lotId'), '');
    form.setValue(name('expiryDate'), '');
    form.setValue(name('serialText'), '');
    form.setValue(name('serialIds'), []);
  };

  return (
    <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="grid items-start gap-3 md:grid-cols-[1.5rem_minmax(0,1fr)_8rem_8rem_9rem_2.25rem]">
        <span className="bg-primary text-primary-foreground mt-2 flex size-6 items-center justify-center rounded-full text-xs">
          {index + 1}
        </span>
        <FormField
          control={control}
          name={name('item')}
          render={({ field }) => (
            <FormItem>
              <ItemPicker
                value={field.value as StockItemDto | null}
                onChange={(picked) => {
                  field.onChange(picked);
                  resetTracking();
                }}
                warehouseId={pickerWarehouse || undefined}
                inStock={!incoming && !!outgoingFrom && type !== 'ADJUSTMENT'}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        {type === 'ADJUSTMENT' ? (
          <FormField
            control={control}
            name={name('direction')}
            render={({ field }) => (
              <FormItem>
                <Select
                  value={field.value as string}
                  onValueChange={(value) => {
                    field.onChange(value);
                    resetTracking();
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">{t('inventory.movements.surplus')}</SelectItem>
                    <SelectItem value="OUT">{t('inventory.movements.shortage')}</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
        ) : (
          <div className="hidden md:block" />
        )}
        <FormField
          control={control}
          name={name('quantity')}
          render={({ field }) => (
            <FormItem>
              <div className="relative">
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder={t('inventory.quantity')}
                    className="pr-12 text-right tabular-nums"
                    disabled={item?.trackingType === 'SERIAL'}
                    {...field}
                    value={
                      item?.trackingType === 'SERIAL'
                        ? String(serialCount)
                        : (field.value as string)
                    }
                  />
                </FormControl>
                {item && (
                  <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                    {item.unitCode}
                  </span>
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        {type === 'RECEIPT' ? (
          <FormField
            control={control}
            name={name('unitCost')}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    placeholder={
                      item ? formatMoney(item.averageCost) : t('inventory.movements.unitCost')
                    }
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="text-muted-foreground hidden pt-2 text-right text-sm tabular-nums md:block">
            {item && formatMoney(item.averageCost)}
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive"
          aria-label={t('common.delete')}
          disabled={!onRemove}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>

      {item?.trackingType === 'LOT' && (
        <div className="grid gap-3 md:ml-9 md:grid-cols-2">
          {incoming ? (
            <>
              <FormField
                control={control}
                name={name('lotNo')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventory.movements.lot')}</FormLabel>
                    <FormControl>
                      <Input placeholder="LOT-2026-01" {...field} value={field.value as string} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={name('expiryDate')}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventory.movements.expiryDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value as string} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          ) : (
            <FormField
              control={control}
              name={name('lotId')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('inventory.movements.lot')}</FormLabel>
                  <LotSelect
                    variantId={item.variantId}
                    warehouseId={outgoingFrom}
                    value={field.value as string}
                    onChange={field.onChange}
                    unit={item.unitCode}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}

      {item?.trackingType === 'SERIAL' && (
        <div className="md:ml-9">
          {incoming ? (
            <FormField
              control={control}
              name={name('serialText')}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('inventory.movements.serials')}</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      placeholder={t('inventory.movements.serialsHint')}
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ) : (
            <FormField
              control={control}
              name={name('serialIds')}
              render={({ field }) => (
                <FormItem className="max-w-sm">
                  <FormLabel>{t('inventory.movements.serials')}</FormLabel>
                  <SerialSelect
                    variantId={item.variantId}
                    warehouseId={outgoingFrom}
                    value={field.value as string[]}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function WarehouseField({
  control,
  name,
  label,
}: {
  control: Control<FormValues>;
  name: 'sourceWarehouseId' | 'targetWarehouseId';
  label: string;
}) {
  const { t } = useTranslation();
  const options = useWarehouseOptions();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
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
      )}
    />
  );
}

export function MovementFormPage({ initialType }: { initialType?: StockMovementType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const create = useStockMovementsCreate();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: initialType ?? StockMovementType.RECEIPT,
      movementDate: today(),
      sourceWarehouseId: '',
      targetWarehouseId: '',
      reference: '',
      notes: '',
      lines: [emptyLine()],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const [type, sourceId, targetId, values] = useWatch({
    control: form.control,
    name: ['type', 'sourceWarehouseId', 'targetWarehouseId', 'lines'],
  });
  const [needsSource, needsTarget] = WAREHOUSES[type];

  // Lots and serials are picked per warehouse, so a warehouse or type change voids them.
  useEffect(() => {
    form.getValues('lines').forEach((_, index) => {
      form.setValue(`lines.${index}.lotId`, '');
      form.setValue(`lines.${index}.serialIds`, []);
    });
  }, [type, sourceId, targetId, form]);

  const totalValue =
    type === 'RECEIPT'
      ? values.reduce((sum, line) => {
          if (!line.item) return sum;
          const quantity =
            line.item.trackingType === 'SERIAL'
              ? parseSerials(line.serialText).length
              : toNumber(line.quantity) || 0;
          const cost = line.unitCost ? toNumber(line.unitCost) : Number(line.item.averageCost);
          return sum + quantity * (cost || 0);
        }, 0)
      : null;

  const onSubmit = (data: FormValues) => {
    create.mutate(
      {
        data: {
          type: data.type,
          movementDate: data.movementDate,
          sourceWarehouseId: needsSource ? data.sourceWarehouseId : undefined,
          targetWarehouseId: needsTarget ? data.targetWarehouseId : undefined,
          reference: data.reference.trim() || undefined,
          notes: data.notes.trim() || undefined,
          lines: data.lines.map((line) => toLineInput(data.type, line)),
        },
      },
      {
        onSuccess: async (movement) => {
          toast.success(t('inventory.movements.posted', { number: movement.number }));
          await invalidate(
            getStockMovementsFindAllQueryKey(),
            getStockFindLevelsQueryKey(),
            getStockSummaryQueryKey(),
            getProductsFindAllQueryKey(),
          );
          await navigate({ to: '/inventory/movements/$id', params: { id: movement.id } });
        },
      },
    );
  };

  return (
    <>
      <Link
        to="/inventory/movements"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('inventory.movements.title')}
      </Link>
      <PageHeader
        title={t('inventory.movements.new')}
        description={t(`inventory.movements.typeHints.${type}`)}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventory.movements.type')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(StockMovementType).map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`inventory.movementTypes.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="movementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('inventory.movements.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" max={today()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {needsSource && (
                <WarehouseField
                  control={form.control}
                  name="sourceWarehouseId"
                  label={t('inventory.movements.source')}
                />
              )}
              {needsTarget && (
                <WarehouseField
                  control={form.control}
                  name="targetWarehouseId"
                  label={
                    type === 'ADJUSTMENT'
                      ? t('inventory.warehouse')
                      : t('inventory.movements.target')
                  }
                />
              )}
              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem className={needsSource && needsTarget ? '' : 'lg:col-span-1'}>
                    <FormLabel>{t('inventory.movements.reference')}</FormLabel>
                    <FormControl>
                      <Input placeholder={t('inventory.movements.referenceHint')} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-3">
                    <FormLabel>{t('common.notes')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t('inventory.movements.lines')} ({lines.fields.length})
              </CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => lines.append(emptyLine())}
              >
                <Plus /> {t('inventory.movements.addLine')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {lines.fields.map((field, index) => (
                <LineRow
                  key={field.id}
                  index={index}
                  form={form}
                  type={type}
                  sourceId={sourceId}
                  targetId={targetId}
                  onRemove={lines.fields.length > 1 ? () => lines.remove(index) : undefined}
                />
              ))}
              {totalValue !== null && (
                <div className="flex justify-end gap-3 pt-2 text-sm">
                  <span className="text-muted-foreground">
                    {t('inventory.movements.totalValue')}
                  </span>
                  <span className="font-semibold tabular-nums">{formatMoney(totalValue)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link to="/inventory/movements">{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="animate-spin" />}
              {t('inventory.movements.post')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}
