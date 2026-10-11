import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, useWatch, type Control, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import type { StockItemDto } from '@/api/generated/model';
import { ItemPicker } from '@/features/inventory/inventory-components';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { lineAmounts, parseDecimal } from './document-math';

export const documentLineSchema = z.object({
  item: z.custom<StockItemDto | null>(),
  description: z.string(),
  quantity: z.string(),
  unitPrice: z.string(),
  discountRate: z.string(),
  vatRate: z.string(),
  /** Line of the source document (request, quote, order) this line was copied from. */
  sourceLineId: z.string().optional(),
  /** Upper bound for quantity, e.g. what is left to receive or invoice. */
  maxQuantity: z.number().optional(),
  unitCode: z.string().optional(),
});
export type DocumentLineValues = z.infer<typeof documentLineSchema>;

export const emptyDocumentLine = (): DocumentLineValues => ({
  item: null,
  description: '',
  quantity: '1',
  unitPrice: '',
  discountRate: '0',
  vatRate: '20',
});

/** Validates one line; pass it to `superRefine` of the document schema. */
export function validateDocumentLines(
  lines: DocumentLineValues[],
  ctx: z.RefinementCtx,
  { requireItem = false, priced = true } = {},
) {
  lines.forEach((line, index) => {
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['lines', index, field], message });
    if (!line.item && (requireItem || !line.description.trim())) {
      issue('item', 'validation.required');
    }
    const quantity = parseDecimal(line.quantity);
    if (!(quantity > 0)) issue('quantity', 'trade.errors.quantity');
    else if (line.maxQuantity !== undefined && quantity > line.maxQuantity + 1e-9) {
      issue('quantity', 'trade.errors.maxQuantity');
    }
    if (priced) {
      if (!(parseDecimal(line.unitPrice) >= 0)) issue('unitPrice', 'validation.number');
      const discount = parseDecimal(line.discountRate || '0');
      if (!(discount >= 0 && discount <= 100)) issue('discountRate', 'trade.errors.percent');
      const vat = parseDecimal(line.vatRate || '0');
      if (!(vat >= 0 && vat <= 100)) issue('vatRate', 'trade.errors.percent');
    }
  });
}

/** Line amounts of the form values; invalid numbers count as zero. */
export function toLineInput(line: DocumentLineValues) {
  const n = (value: string) => {
    const parsed = parseDecimal(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  return {
    quantity: n(line.quantity),
    unitPrice: n(line.unitPrice),
    discountRate: n(line.discountRate),
    vatRate: n(line.vatRate),
  };
}

type LinesForm = UseFormReturn<{ lines: DocumentLineValues[] }>;

interface DocumentLinesEditorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  /** Which product price fills in when an item is picked. */
  priceKind: 'purchase' | 'sale';
  currency: string;
  /** Free-text lines (no item) are allowed, e.g. purchase requests. */
  allowFreeText?: boolean;
  /** Hide price, discount and VAT (purchase requests use an estimated price only). */
  priced?: boolean;
  /** Lines come from a source document: items are fixed and no lines can be added. */
  fixedItems?: boolean;
  title?: string;
}

export function DocumentLinesEditor({
  form: anyForm,
  priceKind,
  currency,
  allowFreeText = false,
  priced = true,
  fixedItems = false,
  title,
}: DocumentLinesEditorProps) {
  const { t } = useTranslation();
  const form = anyForm as LinesForm;
  const lines = useFieldArray({ control: form.control, name: 'lines' });

  const grid = priced
    ? 'md:grid-cols-[1.5rem_minmax(0,1fr)_6.5rem_7.5rem_4.5rem_4.5rem_7.5rem_2.25rem]'
    : 'md:grid-cols-[1.5rem_minmax(0,1fr)_7rem_8rem_2.25rem]';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {title ?? t('trade.lines')} ({lines.fields.length})
        </CardTitle>
        {!fixedItems && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => lines.append(emptyDocumentLine())}
          >
            <Plus /> {t('trade.addLine')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div
          className={`text-muted-foreground hidden gap-3 px-3 text-xs font-medium md:grid ${grid}`}
        >
          <span>#</span>
          <span>{t('trade.item')}</span>
          <span className="text-right">{t('trade.quantity')}</span>
          <span className="text-right">
            {priced ? t('trade.unitPrice') : t('trade.estimatedPrice')}
          </span>
          {priced && (
            <>
              <span className="text-right">{t('trade.discountShort')}</span>
              <span className="text-right">{t('trade.vatShort')}</span>
              <span className="text-right">{t('trade.lineTotal')}</span>
            </>
          )}
          <span />
        </div>
        {lines.fields.map((field, index) => (
          <LineRow
            key={field.id}
            form={form}
            index={index}
            grid={grid}
            priceKind={priceKind}
            currency={currency}
            allowFreeText={allowFreeText}
            priced={priced}
            fixedItems={fixedItems}
            onRemove={lines.fields.length > 1 ? () => lines.remove(index) : undefined}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function LineRow({
  form,
  index,
  grid,
  priceKind,
  currency,
  allowFreeText,
  priced,
  fixedItems,
  onRemove,
}: {
  form: LinesForm;
  index: number;
  grid: string;
  priceKind: 'purchase' | 'sale';
  currency: string;
  allowFreeText: boolean;
  priced: boolean;
  fixedItems: boolean;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const control = form.control as Control<{ lines: DocumentLineValues[] }>;
  const line = useWatch({ control, name: `lines.${index}` });
  const name = (field: keyof DocumentLineValues) => `lines.${index}.${field}` as const;
  const amounts = lineAmounts(toLineInput(line));
  const unit = line.item?.unitCode ?? line.unitCode;

  const pick = (item: StockItemDto) => {
    form.setValue(name('item'), item, { shouldValidate: true });
    const price = priceKind === 'purchase' ? item.purchasePrice : item.salePrice;
    if (price !== null && !line.unitPrice) form.setValue(name('unitPrice'), price);
    if (item.vatRate !== null) form.setValue(name('vatRate'), String(Number(item.vatRate)));
    if (!line.description) {
      form.setValue(
        name('description'),
        item.variantName ? `${item.productName} · ${item.variantName}` : item.productName,
      );
    }
  };

  const numberField = (
    field: 'quantity' | 'unitPrice' | 'discountRate' | 'vatRate',
    suffix?: string,
  ) => (
    <FormField
      control={control}
      name={name(field)}
      render={({ field: input }) => (
        <FormItem>
          <div className="relative">
            <FormControl>
              <Input
                inputMode="decimal"
                className={`text-right tabular-nums ${suffix ? 'pr-9' : ''}`}
                aria-label={t(`trade.${field}`)}
                {...input}
                value={input.value as string}
              />
            </FormControl>
            {suffix && (
              <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs">
                {suffix}
              </span>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <div className={`bg-muted/20 grid items-start gap-3 rounded-lg border p-3 ${grid}`}>
      <span className="bg-primary text-primary-foreground mt-2 flex size-6 items-center justify-center rounded-full text-xs">
        {index + 1}
      </span>
      <div className="min-w-0 space-y-2">
        {fixedItems ? (
          <div className="pt-1.5 text-sm">
            {line.item && (
              <code className="text-muted-foreground mr-2 text-xs">{line.item.sku}</code>
            )}
            {line.description}
            {line.maxQuantity !== undefined && (
              <div className="text-muted-foreground text-xs">
                {t('trade.remaining')}: {line.maxQuantity} {unit}
              </div>
            )}
          </div>
        ) : (
          <>
            <FormField
              control={control}
              name={name('item')}
              render={() => (
                <FormItem>
                  <ItemPicker
                    value={line.item}
                    onChange={pick}
                    includeServices
                    placeholder={allowFreeText ? t('trade.itemOptional') : undefined}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={name('description')}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder={t('trade.description')}
                      className="h-8 text-xs"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>
      {numberField('quantity', unit)}
      {numberField('unitPrice')}
      {priced && (
        <>
          {numberField('discountRate', '%')}
          {numberField('vatRate', '%')}
          <div className="pt-2 text-right text-sm font-medium tabular-nums">
            {formatMoney(amounts.total, currency)}
          </div>
        </>
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
  );
}
