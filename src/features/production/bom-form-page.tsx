import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useForm, useWatch, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useProductionCreateBom,
  useProductionFindBom,
  useProductionUpdateBom,
} from '@/api/generated/endpoints/production/production';
import type { BomDetailDto, BomLineDto, StockItemDto } from '@/api/generated/model';
import { ItemPicker } from '@/features/inventory/inventory-components';
import { parseDecimal } from '@/features/trade/document-math';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import { useInvalidateProduction } from './production-components';
import { bomCost } from './production-rules';

const MAX_LINES = 100;

const number = (value: string) => (value.trim() ? parseDecimal(value) : 0);

const itemSchema = z.custom<StockItemDto | null>();

const lineSchema = z.object({
  item: itemSchema,
  quantity: z.string(),
  scrapRate: z.string(),
  notes: z.string().max(200),
});
type LineValues = z.infer<typeof lineSchema>;

const schema = z
  .object({
    item: itemSchema,
    code: z
      .string()
      .trim()
      .refine((value) => !value || /^[A-Za-z0-9._-]{2,40}$/.test(value), 'validation.code'),
    name: z.string().trim().min(2, 'validation.required').max(150),
    quantity: z.string(),
    laborCost: z.string(),
    overheadCost: z.string(),
    isDefault: z.boolean(),
    notes: z.string().max(1000),
    lines: z.array(lineSchema).min(1),
  })
  .superRefine((values, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
    if (!values.item) issue(['item'], 'validation.required');
    if (!(number(values.quantity) >= 0.001)) issue(['quantity'], 'validation.number');
    for (const field of ['laborCost', 'overheadCost'] as const) {
      const value = number(values[field]);
      if (Number.isNaN(value) || value < 0) issue([field], 'validation.number');
    }
    const seen = new Set<string>();
    values.lines.forEach((line, index) => {
      if (!line.item) {
        issue(['lines', index, 'item'], 'validation.required');
        return;
      }
      if (line.item.variantId === values.item?.variantId) {
        issue(['lines', index, 'item'], 'production.bom.selfComponent');
      } else if (seen.has(line.item.variantId)) {
        issue(['lines', index, 'item'], 'production.bom.duplicateComponent');
      }
      seen.add(line.item.variantId);
      if (!(number(line.quantity) >= 0.0001))
        issue(['lines', index, 'quantity'], 'validation.number');
      const scrap = number(line.scrapRate);
      if (Number.isNaN(scrap) || scrap < 0 || scrap > 100) {
        issue(['lines', index, 'scrapRate'], 'validation.number');
      }
    });
  });
type FormValues = z.infer<typeof schema>;

const emptyLine = (): LineValues => ({ item: null, quantity: '1', scrapRate: '', notes: '' });

const formatInput = (value: string) => (Number(value) ? String(Number(value)) : '');

/** Existing lines carry their rolled-up cost in `averageCost` so the preview matches the API. */
const lineItem = (line: BomLineDto): StockItemDto =>
  ({
    variantId: line.variantId,
    productId: line.productId,
    sku: line.sku,
    productName: line.productName,
    variantName: line.variantName,
    unitCode: line.unitCode,
    averageCost: line.unitCost,
    onHand: line.onHand,
    purchasePrice: null,
  }) as StockItemDto;

const itemCost = (item: StockItemDto | null) => {
  if (!item) return 0;
  const average = Number(item.averageCost);
  return average > 0 ? average : Number(item.purchasePrice ?? 0);
};

export function BomFormPage({ id }: { id?: string }) {
  const { data: bom, isLoading } = useProductionFindBom(id ?? '', { query: { enabled: !!id } });
  if (id && !bom) {
    if (!isLoading) return <RecordNotFound />;
    return <Skeleton className="h-96" />;
  }
  return <BomForm bom={bom} />;
}

function BomForm({ bom }: { bom?: BomDetailDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateProduction();
  const create = useProductionCreateBom();
  const update = useProductionUpdateBom();
  const pending = create.isPending || update.isPending;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      item: bom
        ? ({
            variantId: bom.variantId,
            productId: bom.productId,
            sku: bom.sku,
            productName: bom.productName,
            variantName: bom.variantName,
            unitCode: bom.unitCode,
          } as StockItemDto)
        : null,
      code: bom?.code ?? '',
      name: bom?.name ?? '',
      quantity: bom ? String(Number(bom.quantity)) : '1',
      laborCost: bom ? formatInput(bom.laborCost) : '',
      overheadCost: bom ? formatInput(bom.overheadCost) : '',
      isDefault: bom?.isDefault ?? false,
      notes: bom?.notes ?? '',
      lines: bom
        ? bom.lines.map((line) => ({
            item: lineItem(line),
            quantity: String(Number(line.quantity)),
            scrapRate: formatInput(line.scrapRate),
            notes: line.notes ?? '',
          }))
        : [emptyLine()],
    },
  });
  const lines = useFieldArray({ control: form.control, name: 'lines' });
  const [watchedLines, batchText, laborText, overheadText, output] = useWatch({
    control: form.control,
    name: ['lines', 'quantity', 'laborCost', 'overheadCost', 'item'],
  });
  const batch = number(batchText) || 0;
  const cost = bomCost(
    watchedLines.map((line) => ({
      quantity: number(line.quantity) || 0,
      scrapRate: number(line.scrapRate) || 0,
      unitCost: itemCost(line.item),
    })),
    batch,
    number(laborText) || 0,
    number(overheadText) || 0,
  );

  const submit = (values: FormValues) => {
    const common = {
      name: values.name.trim(),
      quantity: number(values.quantity),
      laborCost: number(values.laborCost),
      overheadCost: number(values.overheadCost),
      isDefault: values.isDefault,
      notes: values.notes.trim() || null,
      lines: values.lines.map((line) => ({
        variantId: line.item!.variantId,
        quantity: number(line.quantity),
        scrapRate: number(line.scrapRate),
        notes: line.notes.trim() || null,
      })),
    };
    const done = async (saved: BomDetailDto) => {
      toast.success(t('production.bom.saved', { code: saved.code }));
      await invalidate();
      await navigate({ to: '/production/boms/$id', params: { id: saved.id } });
    };
    const code = values.code.trim().toUpperCase();
    if (bom) {
      update.mutate(
        { id: bom.id, data: { ...common, code: code || undefined } },
        { onSuccess: done },
      );
    } else {
      create.mutate(
        { data: { ...common, variantId: values.item!.variantId, code: code || undefined } },
        { onSuccess: done },
      );
    }
  };

  const back = bom
    ? ({ to: '/production/boms/$id', params: { id: bom.id } } as const)
    : ({ to: '/production/boms' } as const);

  return (
    <>
      <Link
        {...back}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {bom ? bom.code : t('production.bom.list')}
      </Link>
      <PageHeader
        title={bom ? t('production.bom.edit') : t('production.bom.new')}
        description={t('production.bom.formHint')}
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="item"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('production.bom.output')}</FormLabel>
                    {bom ? (
                      <div className="flex h-9 items-center rounded-md border px-3 text-sm">
                        <code className="text-muted-foreground mr-2 text-xs">{bom.sku}</code>
                        {bom.productName}
                        {bom.variantName && ` · ${bom.variantName}`}
                      </div>
                    ) : (
                      <ItemPicker
                        value={field.value ?? null}
                        onChange={(picked) => {
                          field.onChange(picked);
                          if (!form.getValues('name')) {
                            form.setValue('name', picked.productName);
                          }
                        }}
                        placeholder={t('production.bom.pickOutput')}
                      />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input maxLength={150} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.bom.code')}</FormLabel>
                    <FormControl>
                      <Input
                        maxLength={40}
                        placeholder={
                          output ? `${output.sku}-R1` : t('production.bom.codePlaceholder')
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('production.bom.batch')}
                      {output && ` (${output.unitCode})`}
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="laborCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.bom.laborPerBatch')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="overheadCost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('production.bom.overheadPerBatch')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} step="any" placeholder="0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3 sm:pt-6">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">{t('production.bom.isDefault')}</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2 lg:col-span-4">
                    <FormLabel>{t('common.notes')}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} maxLength={1000} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">{t('production.bom.lines')}</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={lines.fields.length >= MAX_LINES}
                onClick={() => lines.append(emptyLine())}
              >
                <Plus /> {t('production.bom.addLine')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-muted-foreground hidden gap-2 text-xs font-medium lg:grid lg:grid-cols-12">
                <span className="lg:col-span-5">{t('production.component')}</span>
                <span className="lg:col-span-2">{t('production.quantity')}</span>
                <span>{t('production.bom.scrap')}</span>
                <span className="lg:col-span-2">{t('common.notes')}</span>
                <span className="text-right lg:col-span-2">{t('production.cost.line')}</span>
              </div>
              {lines.fields.map((field, index) => (
                <LineRow
                  key={field.id}
                  form={form}
                  index={index}
                  lineCost={
                    (number(watchedLines[index]?.quantity ?? '') || 0) *
                    (1 + (number(watchedLines[index]?.scrapRate ?? '') || 0) / 100) *
                    itemCost(watchedLines[index]?.item ?? null)
                  }
                  canRemove={lines.fields.length > 1}
                  onRemove={() => lines.remove(index)}
                />
              ))}
              <dl className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground text-xs">{t('production.cost.material')}</dt>
                  <dd className="tabular-nums">{formatMoney(cost.material)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {t('production.cost.laborOverhead')}
                  </dt>
                  <dd className="tabular-nums">
                    {formatMoney((number(laborText) || 0) + (number(overheadText) || 0))}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {t('production.cost.batchTotal')}
                  </dt>
                  <dd className="tabular-nums">{formatMoney(cost.total)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">
                    {t('production.cost.estimatedUnit')}
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatMoney(cost.unitCost)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" asChild>
              <Link {...back}>{t('common.cancel')}</Link>
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Form>
    </>
  );
}

function LineRow({
  form,
  index,
  lineCost,
  canRemove,
  onRemove,
}: {
  form: UseFormReturn<FormValues>;
  index: number;
  lineCost: number;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const name = <K extends keyof LineValues>(field: K) => `lines.${index}.${field}` as const;
  return (
    <div className="bg-muted/30 grid gap-2 rounded-lg border p-2 lg:grid-cols-12 lg:border-0 lg:bg-transparent lg:p-0">
      <FormField
        control={form.control}
        name={name('item')}
        render={({ field }) => (
          <FormItem className="lg:col-span-5">
            <ItemPicker
              value={(field.value as StockItemDto | null) ?? null}
              onChange={field.onChange}
            />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={name('quantity')}
        render={({ field }) => (
          <FormItem className="lg:col-span-2">
            <FormControl>
              <Input
                type="number"
                min={0}
                step="any"
                className="text-right tabular-nums"
                aria-label={t('production.quantity')}
                {...field}
                value={field.value as string}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={name('scrapRate')}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="number"
                min={0}
                max={100}
                step="any"
                placeholder="%"
                className="text-right tabular-nums"
                aria-label={t('production.bom.scrap')}
                {...field}
                value={field.value as string}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={name('notes')}
        render={({ field }) => (
          <FormItem className="lg:col-span-2">
            <FormControl>
              <Input
                maxLength={200}
                placeholder={t('common.notes')}
                aria-label={t('common.notes')}
                {...field}
                value={field.value as string}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <div className="flex items-center justify-end gap-1 lg:col-span-2">
        <span className="text-muted-foreground text-sm tabular-nums">{formatMoney(lineCost)}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 shrink-0"
          disabled={!canRemove}
          aria-label={t('production.bom.removeLine')}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
