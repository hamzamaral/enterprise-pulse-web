import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useProductionCreateWorkOrder,
  useProductionFindBoms,
  useProductionRecord,
  useProductionUpdateWorkOrder,
} from '@/api/generated/endpoints/production/production';
import type {
  MaterialAvailability,
  WorkOrderDetailDto,
  WorkOrderStatus,
} from '@/api/generated/model';
import { useWarehouseOptions } from '@/features/inventory/inventory-components';
import { parseDecimal } from '@/features/trade/document-math';
import { today } from '@/features/trade/trade-components';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Textarea } from '@/shared/ui/textarea';
import {
  AVAILABILITY_TONES,
  remainingOutput,
  standardConsumption,
  STATUS_TONES,
} from './production-rules';

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`production.status.${status}`)}</ToneBadge>;
}

export function AvailabilityBadge({ availability }: { availability: MaterialAvailability }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={AVAILABILITY_TONES[availability]}>
      {t(`production.availability.${availability}`)}
    </ToneBadge>
  );
}

/** Refreshes production screens and the stock and purchasing data a record or request touches. */
export function useInvalidateProduction() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['production', 'stock', 'purchase-requests'].some((path) =>
            key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}

const positive = () =>
  z
    .string()
    .trim()
    .min(1, 'validation.required')
    .refine((value) => parseDecimal(value) > 0, 'validation.number');

const addDays = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

/** Create a work order from a bill of materials, or edit a draft one. */
export function WorkOrderDialog({
  open,
  onOpenChange,
  order,
  bomId,
  quantity,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: WorkOrderDetailDto;
  bomId?: string;
  quantity?: string;
  onSaved?: (order: WorkOrderDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateProduction();
  const create = useProductionCreateWorkOrder();
  const update = useProductionUpdateWorkOrder();
  const warehouses = useWarehouseOptions(open);
  const { data: boms } = useProductionFindBoms(
    { isActive: true, pageSize: 100, sortBy: 'code', sortOrder: 'asc' },
    { query: { enabled: open && !order } },
  );
  const bomOptions = order
    ? [{ value: order.bomId, label: `${order.bomCode} · ${order.productName}` }]
    : (boms?.data ?? []).map((bom) => ({
        value: bom.id,
        label: `${bom.code} · ${bom.name}`,
      }));

  const schema = z
    .object({
      bomId: z.string().min(1, 'validation.required'),
      quantity: positive(),
      plannedStart: z.string().min(1, 'validation.required'),
      plannedEnd: z.string().min(1, 'validation.required'),
      sourceWarehouseId: z.string().min(1, 'validation.required'),
      targetWarehouseId: z.string().min(1, 'validation.required'),
      reference: z.string().trim().max(100),
      notes: z.string().trim().max(1000),
    })
    .refine((values) => values.plannedEnd >= values.plannedStart, {
      path: ['plannedEnd'],
      message: 'production.workOrder.endBeforeStart',
    });
  type Values = z.infer<typeof schema>;

  const firstWarehouse = warehouses[0]?.value ?? '';
  const pending = create.isPending || update.isPending;
  const done = async (saved: WorkOrderDetailDto) => {
    toast.success(t('production.workOrder.saved', { number: saved.number }));
    await invalidate();
    onOpenChange(false);
    onSaved?.(saved);
  };
  const submit = (values: Values) => {
    const data = {
      quantity: parseDecimal(values.quantity),
      plannedStart: values.plannedStart,
      plannedEnd: values.plannedEnd,
      sourceWarehouseId: values.sourceWarehouseId,
      targetWarehouseId: values.targetWarehouseId,
      reference: values.reference || null,
      notes: values.notes || null,
    };
    if (order) update.mutate({ id: order.id, data }, { onSuccess: done });
    else create.mutate({ data: { ...data, bomId: values.bomId } }, { onSuccess: done });
  };

  return (
    <SimpleFormDialog<Values>
      open={open && (!!order || warehouses.length > 0)}
      onOpenChange={onOpenChange}
      title={order ? t('production.workOrder.edit') : t('production.workOrder.new')}
      schema={schema}
      pending={pending}
      defaultValues={{
        bomId: order?.bomId ?? bomId ?? '',
        quantity: order ? String(Number(order.quantity)) : (quantity ?? '1'),
        plannedStart: order?.plannedStart.slice(0, 10) ?? today(),
        plannedEnd: order?.plannedEnd.slice(0, 10) ?? addDays(7),
        sourceWarehouseId: order?.sourceWarehouseId ?? firstWarehouse,
        targetWarehouseId: order?.targetWarehouseId ?? firstWarehouse,
        reference: order?.reference ?? '',
        notes: order?.notes ?? '',
      }}
      fields={[
        {
          name: 'bomId',
          label: t('production.bom.title'),
          type: 'select',
          options: bomOptions,
          required: true,
          disabled: !!order,
          wide: true,
        },
        { name: 'quantity', label: t('production.quantity'), type: 'number' },
        { name: 'reference', label: t('production.workOrder.reference') },
        { name: 'plannedStart', label: t('production.workOrder.plannedStart'), type: 'date' },
        { name: 'plannedEnd', label: t('production.workOrder.plannedEnd'), type: 'date' },
        {
          name: 'sourceWarehouseId',
          label: t('production.workOrder.sourceWarehouse'),
          type: 'select',
          options: warehouses,
          required: true,
        },
        {
          name: 'targetWarehouseId',
          label: t('production.workOrder.targetWarehouse'),
          type: 'select',
          options: warehouses,
          required: true,
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
      ]}
      onSubmit={submit}
    />
  );
}

const recordSchema = z.object({
  quantity: positive(),
  recordDate: z.string().min(1, 'validation.required'),
  finish: z.boolean(),
  adjust: z.boolean(),
  components: z.array(
    z.object({
      variantId: z.string(),
      quantity: z
        .string()
        .trim()
        .refine((value) => parseDecimal(value) >= 0, 'validation.number'),
    }),
  ),
  lotNo: z.string().trim().max(50),
  expiryDate: z.string(),
  notes: z.string().trim().max(1000),
});
type RecordValues = z.infer<typeof recordSchema>;

/**
 * Report produced quantity: materials leave the source warehouse at standard consumption
 * (or the adjusted actuals) and the output enters the target warehouse at full cost.
 */
export function RecordDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: WorkOrderDetailDto;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateProduction();
  const record = useProductionRecord();
  const remaining = remainingOutput(order);
  const suggested = Math.min(remaining, Number(order.buildable)) || remaining;

  const defaults = useMemo<RecordValues>(
    () => ({
      quantity: String(suggested),
      recordDate: today(),
      finish: false,
      adjust: false,
      components: order.components.map((c) => ({ variantId: c.variantId, quantity: '' })),
      lotNo: '',
      expiryDate: '',
      notes: '',
    }),
    [order, suggested],
  );
  const form = useForm<RecordValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: defaults,
  });
  useEffect(() => {
    if (open) form.reset(defaults);
  }, [open, defaults, form]);

  const [quantityText, finishFlag, adjust] = useWatch({
    control: form.control,
    name: ['quantity', 'finish', 'adjust'],
  });
  const output = parseDecimal(quantityText) || 0;
  const finishes = finishFlag || (output > 0 && output >= remaining);
  const standard = order.components.map((c) =>
    standardConsumption(
      {
        quantityPer: Number(c.quantityPer),
        requiredQty: Number(c.requiredQty),
        consumedQty: Number(c.consumedQty),
      },
      output,
      finishes,
    ),
  );
  const standardKey = standard.join('|');

  useEffect(() => {
    if (adjust) return;
    standardKey.split('|').forEach((value, index) => {
      form.setValue(`components.${index}.quantity`, value);
    });
  }, [adjust, standardKey, form]);

  const submit = (values: RecordValues) => {
    const quantity = parseDecimal(values.quantity);
    if (quantity > remaining) {
      form.setError('quantity', {
        message: t('production.record.tooMuch', { value: remaining }),
      });
      return;
    }
    record.mutate(
      {
        id: order.id,
        data: {
          quantity,
          recordDate: values.recordDate,
          finish: values.finish || undefined,
          components: values.adjust
            ? values.components.map((c) => ({
                variantId: c.variantId,
                quantity: parseDecimal(c.quantity),
              }))
            : undefined,
          lotNo: order.lotTracked ? values.lotNo || undefined : undefined,
          expiryDate: order.lotTracked ? values.expiryDate || undefined : undefined,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: async (saved) => {
          const last = saved.records[0];
          toast.success(t('production.record.saved', { number: last?.number ?? saved.number }));
          await invalidate();
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('production.record.title', { number: order.number })}</DialogTitle>
        </DialogHeader>
        <p className="text-muted-foreground text-sm">
          {t('production.record.hint', {
            remaining: formatQuantity(remaining, order.unitCode),
            buildable: formatQuantity(order.buildable, order.unitCode),
          })}
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.record.quantity')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="recordDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.record.date')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="finish"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 sm:pt-6">
                    <FormControl>
                      <Switch
                        checked={finishes}
                        disabled={output >= remaining}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">{t('production.record.finish')}</FormLabel>
                  </FormItem>
                )}
              />
              {order.lotTracked && (
                <>
                  <FormField
                    control={form.control}
                    name="lotNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('production.record.lotNo')}</FormLabel>
                        <FormControl>
                          <Input placeholder={order.number} maxLength={50} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('production.record.expiryDate')}</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium">{t('production.record.materials')}</span>
                <FormField
                  control={form.control}
                  name="adjust"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0 text-sm font-normal">
                        {t('production.record.adjust')}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('production.component')}</TableHead>
                    <TableHead className="text-right">{t('production.remaining')}</TableHead>
                    <TableHead className="text-right">{t('production.onHand')}</TableHead>
                    <TableHead className="w-36 text-right">
                      {t('production.record.consumed')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.components.map((component, index) => (
                    <TableRow key={component.id}>
                      <TableCell>
                        <code className="text-muted-foreground mr-2 text-xs">{component.sku}</code>
                        {component.productName}
                        {component.variantName && ` · ${component.variantName}`}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(component.remainingQty, component.unitCode)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatQuantity(component.onHand, component.unitCode)}
                      </TableCell>
                      <TableCell className="text-right">
                        <FormField
                          control={form.control}
                          name={`components.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  className="h-8 text-right tabular-nums"
                                  disabled={!adjust}
                                  aria-label={t('production.record.consumed')}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('common.notes')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={1000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={record.isPending}>
                {record.isPending && <Loader2 className="animate-spin" />}
                {t('production.record.submit')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
