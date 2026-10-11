import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getStockFindLevelsQueryKey,
  getStockMovementsFindAllQueryKey,
  getStockSummaryQueryKey,
} from '@/api/generated/endpoints/inventory/inventory';
import {
  getDeliveryNotesFindAllQueryKey,
  getSalesOrdersFindAllQueryKey,
  getSalesOrdersFindOneQueryKey,
  useDeliveryNotesCreate,
  useSalesOrdersFindAll,
  useSalesOrdersFindOne,
} from '@/api/generated/endpoints/sales/sales';
import type { SalesOrderDetailDto, TrackingType } from '@/api/generated/model';
import { LotSelect, SerialSelect } from '@/features/inventory/movement-form-page';
import { parseDecimal } from '@/features/trade/document-math';
import { PageHeader } from '@/shared/components/page-header';
import { formatQuantity } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { today } from '@/features/trade/trade-components';
import { openToDeliver } from './order-detail-page';

const lineSchema = z.object({
  orderLineId: z.string(),
  variantId: z.string(),
  include: z.boolean(),
  label: z.string(),
  sku: z.string(),
  unitCode: z.string(),
  trackingType: z.custom<TrackingType | null>(),
  remaining: z.number(),
  reserved: z.number(),
  quantity: z.string(),
  lotId: z.string(),
  serialIds: z.array(z.string()),
});

const schema = z
  .object({
    deliveryDate: v.requiredString(),
    shippingAddress: z.string(),
    carrier: z.string(),
    notes: z.string(),
    lines: z.array(lineSchema),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (!values.lines.some((line) => line.include)) {
      issue(['lines'], 'sales.deliveries.errors.noLines');
    }
    values.lines.forEach((line, index) => {
      if (!line.include) return;
      const path = (field: string) => ['lines', index, field];
      if (line.trackingType === 'SERIAL') {
        if (!line.serialIds.length) {
          return issue(path('serialIds'), 'inventory.movements.errors.serialsRequired');
        }
        if (line.serialIds.length > line.remaining) {
          issue(path('serialIds'), 'trade.errors.maxQuantity');
        }
        return;
      }
      const quantity = parseDecimal(line.quantity);
      if (!(quantity > 0)) issue(path('quantity'), 'trade.errors.quantity');
      else if (quantity > line.remaining + 1e-9)
        issue(path('quantity'), 'trade.errors.maxQuantity');
      if (line.trackingType === 'LOT' && !line.lotId) issue(path('lotId'), 'validation.required');
    });
  });

type FormValues = z.infer<typeof schema>;

const toLines = (order: SalesOrderDetailDto): FormValues['lines'] =>
  order.lines
    .filter((line) => line.variantId && openToDeliver(line) > 0)
    .map((line) => ({
      orderLineId: line.id,
      variantId: line.variantId!,
      include: true,
      label: line.description,
      sku: line.sku ?? '',
      unitCode: line.unitCode ?? '',
      trackingType: line.trackingType,
      remaining: openToDeliver(line),
      reserved: Number(line.reservedQty),
      quantity: String(openToDeliver(line)),
      lotId: '',
      serialIds: [],
    }));

function OrderSelect({ onChange }: { onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data } = useSalesOrdersFindAll({ open: true, pageSize: 100, sortBy: 'orderDate' });
  const orders = (data?.data ?? []).filter(
    (o) => o.status === 'APPROVED' || o.status === 'PARTIALLY_DELIVERED',
  );
  return (
    <div className="max-w-xl space-y-2">
      <Label>{t('sales.orders.single')}</Label>
      <Select onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('sales.deliveries.selectOrder')} />
        </SelectTrigger>
        <SelectContent>
          {orders.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.number} · {o.partnerTitle} · %{o.deliveredPercent}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {data && !orders.length && (
        <p className="text-muted-foreground text-sm">{t('sales.deliveries.noOpenOrders')}</p>
      )}
    </div>
  );
}

function DeliveryLine({
  control,
  index,
  warehouseId,
}: {
  control: Control<FormValues>;
  index: number;
  warehouseId: string;
}) {
  const { t } = useTranslation();
  const line = useWatch({ control, name: `lines.${index}` });
  return (
    <div className="bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="grid items-start gap-3 md:grid-cols-[1.5rem_minmax(0,1fr)_9rem]">
        <FormField
          control={control}
          name={`lines.${index}.include`}
          render={({ field }) => (
            <Checkbox
              className="mt-2"
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-label={line.label}
            />
          )}
        />
        <div className="pt-1 text-sm">
          {line.sku && <code className="text-muted-foreground mr-2 text-xs">{line.sku}</code>}
          {line.label}
          <div className="text-muted-foreground text-xs">
            {t('trade.remaining')}: {formatQuantity(line.remaining, line.unitCode)} ·{' '}
            {t('sales.orders.reservedQty')}: {formatQuantity(line.reserved, line.unitCode)}
          </div>
        </div>
        {line.trackingType === 'SERIAL' ? (
          <div className="pt-1.5 text-right text-sm tabular-nums">
            {formatQuantity(line.serialIds.length, line.unitCode)}
          </div>
        ) : (
          <FormField
            control={control}
            name={`lines.${index}.quantity`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    disabled={!line.include}
                    aria-label={t('trade.quantity')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>
      {line.include && line.trackingType === 'LOT' && (
        <div className="md:pl-9">
          <FormField
            control={control}
            name={`lines.${index}.lotId`}
            render={({ field }) => (
              <FormItem className="max-w-sm">
                <FormLabel className="text-xs">{t('inventory.movements.lot')}</FormLabel>
                <LotSelect
                  variantId={line.variantId}
                  warehouseId={warehouseId}
                  value={field.value}
                  onChange={field.onChange}
                  unit={line.unitCode}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
      {line.include && line.trackingType === 'SERIAL' && (
        <div className="md:pl-9">
          <FormField
            control={control}
            name={`lines.${index}.serialIds`}
            render={({ field }) => (
              <FormItem className="max-w-sm">
                <FormLabel className="text-xs">{t('inventory.movements.serials')}</FormLabel>
                <SerialSelect
                  variantId={line.variantId}
                  warehouseId={warehouseId}
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

export function DeliveryFormPage({ orderId }: { orderId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const create = useDeliveryNotesCreate();
  const { data: order } = useSalesOrdersFindOne(orderId ?? '', {
    query: { enabled: !!orderId },
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      deliveryDate: today(),
      shippingAddress: '',
      carrier: '',
      notes: '',
      lines: [],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });

  useEffect(() => {
    if (order) form.setValue('lines', toLines(order));
  }, [order, form]);

  const onSubmit = (data: FormValues) => {
    if (!orderId) return;
    create.mutate(
      {
        data: {
          orderId,
          deliveryDate: data.deliveryDate,
          shippingAddress: data.shippingAddress.trim() || undefined,
          carrier: data.carrier.trim() || undefined,
          notes: data.notes.trim() || undefined,
          lines: data.lines
            .filter((line) => line.include)
            .map((line) => ({
              orderLineId: line.orderLineId,
              quantity:
                line.trackingType === 'SERIAL'
                  ? line.serialIds.length
                  : parseDecimal(line.quantity),
              ...(line.trackingType === 'LOT' && { lotId: line.lotId }),
              ...(line.trackingType === 'SERIAL' && { serialIds: line.serialIds }),
            })),
        },
      },
      {
        onSuccess: async (note) => {
          toast.success(t('sales.deliveries.created', { number: note.number }));
          await invalidate(
            getDeliveryNotesFindAllQueryKey(),
            getSalesOrdersFindAllQueryKey(),
            getSalesOrdersFindOneQueryKey(orderId),
            getStockMovementsFindAllQueryKey(),
            getStockFindLevelsQueryKey(),
            getStockSummaryQueryKey(),
          );
          await navigate({ to: '/sales/deliveries/$id', params: { id: note.id } });
        },
      },
    );
  };

  const linesError =
    form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message;

  return (
    <>
      <Link
        to="/sales/deliveries"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('sales.deliveries.title')}
      </Link>
      <PageHeader
        title={t('sales.deliveries.new')}
        description={
          order
            ? t('sales.deliveries.forOrder', {
                number: order.number,
                partner: order.partnerTitle,
                warehouse: order.warehouseName,
              })
            : t('sales.deliveries.newHint')
        }
      />
      {!orderId ? (
        <Card>
          <CardContent className="pt-6">
            <OrderSelect
              onChange={(id) =>
                void navigate({ to: '/sales/deliveries/new', search: { orderId: id } })
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <Card>
              <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('sales.deliveries.date')}</FormLabel>
                      <FormControl>
                        <Input type="date" max={today()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('sales.deliveries.carrier')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('common.notes')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="shippingAddress"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2 lg:col-span-4">
                      <FormLabel>{t('sales.deliveries.shippingAddress')}</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder={t('sales.deliveries.shippingAddressHint')}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('sales.deliveries.lines')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!order ? (
                  <Loader2 className="text-muted-foreground animate-spin" />
                ) : lines.fields.length ? (
                  lines.fields.map((field, index) => (
                    <DeliveryLine
                      key={field.id}
                      control={form.control}
                      index={index}
                      warehouseId={order.warehouseId}
                    />
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t('sales.deliveries.nothingLeft')}
                  </p>
                )}
                {linesError && <p className="text-destructive text-sm">{t(linesError as never)}</p>}
              </CardContent>
            </Card>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => window.history.back()}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={create.isPending || !lines.fields.length}>
                {create.isPending && <Loader2 className="animate-spin" />}
                {t('sales.deliveries.post')}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </>
  );
}
