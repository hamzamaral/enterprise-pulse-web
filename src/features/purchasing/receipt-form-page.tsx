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
  getGoodsReceiptsFindAllQueryKey,
  getPurchaseOrdersFindAllQueryKey,
  getPurchaseOrdersFindOneQueryKey,
  useGoodsReceiptsCreate,
  usePurchaseOrdersFindAll,
  usePurchaseOrdersFindOne,
} from '@/api/generated/endpoints/purchasing/purchasing';
import type { PurchaseOrderDetailDto, TrackingType } from '@/api/generated/model';
import { useWarehouseOptions } from '@/features/inventory/inventory-components';
import { parseSerials } from '@/features/inventory/movement-form-page';
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
import { today } from './purchasing-components';

const lineSchema = z.object({
  orderLineId: z.string(),
  include: z.boolean(),
  label: z.string(),
  sku: z.string(),
  unitCode: z.string(),
  service: z.boolean(),
  trackingType: z.custom<TrackingType | null>(),
  remaining: z.number(),
  quantity: z.string(),
  lotNo: z.string(),
  expiryDate: z.string(),
  serialText: z.string(),
});

const schema = z
  .object({
    receiptDate: v.requiredString(),
    warehouseId: v.requiredString(),
    deliveryNoteNo: z.string(),
    notes: z.string(),
    lines: z.array(lineSchema),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (!values.lines.some((line) => line.include)) {
      issue(['lines'], 'purchasing.receipts.errors.noLines');
    }
    values.lines.forEach((line, index) => {
      if (!line.include) return;
      const path = (field: string) => ['lines', index, field];
      const quantity =
        line.trackingType === 'SERIAL'
          ? parseSerials(line.serialText).length
          : parseDecimal(line.quantity);
      if (line.trackingType === 'SERIAL' && !quantity) {
        return issue(path('serialText'), 'inventory.movements.errors.serialsRequired');
      }
      if (!(quantity > 0)) issue(path('quantity'), 'trade.errors.quantity');
      else if (quantity > line.remaining + 1e-9) {
        issue(
          path(line.trackingType === 'SERIAL' ? 'serialText' : 'quantity'),
          'trade.errors.maxQuantity',
        );
      }
      if (line.trackingType === 'LOT' && !line.lotNo.trim()) {
        issue(path('lotNo'), 'validation.required');
      }
    });
  });

type FormValues = z.infer<typeof schema>;

const toLines = (order: PurchaseOrderDetailDto): FormValues['lines'] =>
  order.lines
    .map((line) => ({ line, remaining: Number(line.quantity) - Number(line.receivedQty) }))
    .filter(({ remaining }) => remaining > 0)
    .map(({ line, remaining }) => ({
      orderLineId: line.id,
      include: true,
      label: line.description,
      sku: line.sku ?? '',
      unitCode: line.unitCode ?? '',
      service: line.productType === 'SERVICE',
      trackingType: line.trackingType,
      remaining,
      quantity: String(remaining),
      lotNo: '',
      expiryDate: '',
      serialText: '',
    }));

function OrderSelect({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { data } = usePurchaseOrdersFindAll({ open: true, pageSize: 100, sortBy: 'orderDate' });
  const orders = (data?.data ?? []).filter(
    (o) => o.status === 'APPROVED' || o.status === 'PARTIALLY_RECEIVED',
  );
  return (
    <div className="max-w-xl space-y-2">
      <Label>{t('purchasing.orders.single')}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t('purchasing.receipts.selectOrder')} />
        </SelectTrigger>
        <SelectContent>
          {orders.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.number} · {o.partnerTitle} · %{o.receivedPercent}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {data && !orders.length && (
        <p className="text-muted-foreground text-sm">{t('purchasing.receipts.noOpenOrders')}</p>
      )}
    </div>
  );
}

function ReceiptLine({ control, index }: { control: Control<FormValues>; index: number }) {
  const { t } = useTranslation();
  const line = useWatch({ control, name: `lines.${index}` });
  const serialCount = parseSerials(line.serialText).length;
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
            {t('trade.remaining')}: {formatQuantity(line.remaining, line.unitCode)}
            {line.service && ` · ${t('purchasing.receipts.serviceHint')}`}
          </div>
        </div>
        {line.trackingType === 'SERIAL' ? (
          <div className="pt-1.5 text-right text-sm tabular-nums">
            {formatQuantity(serialCount, line.unitCode)}
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
        <div className="grid gap-3 sm:grid-cols-2 md:pl-9">
          <FormField
            control={control}
            name={`lines.${index}.lotNo`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t('inventory.movements.lot')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`lines.${index}.expiryDate`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t('inventory.movements.expiryDate')}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
      )}
      {line.include && line.trackingType === 'SERIAL' && (
        <div className="md:pl-9">
          <FormField
            control={control}
            name={`lines.${index}.serialText`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t('inventory.movements.serials')}</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    className="font-mono text-xs"
                    placeholder={t('inventory.movements.serialsHint')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
    </div>
  );
}

export function ReceiptFormPage({ orderId }: { orderId?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const warehouses = useWarehouseOptions();
  const create = useGoodsReceiptsCreate();
  const { data: order } = usePurchaseOrdersFindOne(orderId ?? '', {
    query: { enabled: !!orderId },
  });
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      receiptDate: today(),
      warehouseId: '',
      deliveryNoteNo: '',
      notes: '',
      lines: [],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });

  useEffect(() => {
    if (!order) return;
    form.setValue('warehouseId', order.warehouseId);
    form.setValue('lines', toLines(order));
  }, [order, form]);

  const onSubmit = (data: FormValues) => {
    if (!orderId) return;
    create.mutate(
      {
        data: {
          orderId,
          receiptDate: data.receiptDate,
          warehouseId: data.warehouseId,
          deliveryNoteNo: data.deliveryNoteNo.trim() || undefined,
          notes: data.notes.trim() || undefined,
          lines: data.lines
            .filter((line) => line.include)
            .map((line) => {
              const serialNos = parseSerials(line.serialText);
              return {
                orderLineId: line.orderLineId,
                quantity:
                  line.trackingType === 'SERIAL' ? serialNos.length : parseDecimal(line.quantity),
                ...(line.trackingType === 'LOT' && {
                  lotNo: line.lotNo.trim(),
                  expiryDate: line.expiryDate || undefined,
                }),
                ...(line.trackingType === 'SERIAL' && { serialNos }),
              };
            }),
        },
      },
      {
        onSuccess: async (receipt) => {
          toast.success(t('purchasing.receipts.created', { number: receipt.number }));
          await invalidate(
            getGoodsReceiptsFindAllQueryKey(),
            getPurchaseOrdersFindAllQueryKey(),
            getPurchaseOrdersFindOneQueryKey(orderId),
            getStockMovementsFindAllQueryKey(),
            getStockFindLevelsQueryKey(),
            getStockSummaryQueryKey(),
          );
          await navigate({ to: '/purchasing/receipts/$id', params: { id: receipt.id } });
        },
      },
    );
  };

  const linesError =
    form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message;

  return (
    <>
      <Link
        to="/purchasing/receipts"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('purchasing.receipts.title')}
      </Link>
      <PageHeader
        title={t('purchasing.receipts.new')}
        description={
          order
            ? t('purchasing.receipts.forOrder', {
                number: order.number,
                partner: order.partnerTitle,
              })
            : t('purchasing.receipts.newHint')
        }
      />
      {!orderId ? (
        <Card>
          <CardContent className="pt-6">
            <OrderSelect
              onChange={(id) =>
                void navigate({ to: '/purchasing/receipts/new', search: { orderId: id } })
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
                  name="receiptDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('purchasing.receipts.date')}</FormLabel>
                      <FormControl>
                        <Input type="date" max={today()} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="warehouseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('purchasing.orders.warehouse')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('common.select')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {warehouses.map((w) => (
                            <SelectItem key={w.value} value={w.value}>
                              {w.label}
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
                  name="deliveryNoteNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('purchasing.receipts.deliveryNoteNo')}</FormLabel>
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
                    <FormItem>
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
              <CardHeader>
                <CardTitle className="text-base">{t('purchasing.receipts.lines')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!order ? (
                  <Loader2 className="text-muted-foreground animate-spin" />
                ) : lines.fields.length ? (
                  lines.fields.map((field, index) => (
                    <ReceiptLine key={field.id} control={form.control} index={index} />
                  ))
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {t('purchasing.receipts.nothingLeft')}
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
                {t('purchasing.receipts.post')}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </>
  );
}
