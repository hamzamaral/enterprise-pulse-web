import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useProductCategoriesFindAll,
  useStockFindItems,
  useWarehousesFindAll,
} from '@/api/generated/endpoints/inventory/inventory';
import type {
  StockCountStatus,
  StockItemDto,
  StockMovementType,
  TrackingType,
} from '@/api/generated/model';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { formatQuantity } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export const ALL = 'all';

const MOVEMENT_TONES: Record<StockMovementType, Tone> = {
  RECEIPT: 'success',
  ISSUE: 'warning',
  TRANSFER: 'info',
  ADJUSTMENT: 'neutral',
};

export function MovementTypeBadge({ type }: { type: StockMovementType }) {
  const { t } = useTranslation();
  return <ToneBadge tone={MOVEMENT_TONES[type]}>{t(`inventory.movementTypes.${type}`)}</ToneBadge>;
}

const COUNT_TONES: Record<StockCountStatus, Tone> = {
  DRAFT: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
};

export function CountStatusBadge({ status }: { status: StockCountStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={COUNT_TONES[status]}>{t(`inventory.countStatus.${status}`)}</ToneBadge>;
}

export function TrackingBadge({ tracking }: { tracking: TrackingType }) {
  const { t } = useTranslation();
  if (tracking === 'NONE') return null;
  return (
    <ToneBadge tone={tracking === 'SERIAL' ? 'info' : 'warning'}>
      {t(`inventory.trackingTypes.${tracking}`)}
    </ToneBadge>
  );
}

export function LowStockBadge() {
  const { t } = useTranslation();
  return <ToneBadge tone="danger">{t('inventory.lowStock')}</ToneBadge>;
}

/** "Mouse · Siyah", or just the product name for the default variant. */
export function itemName(productName: string, variantName: string | null | undefined) {
  return variantName ? `${productName} · ${variantName}` : productName;
}

/** "Renk=Siyah, Beden=M" → { Renk: 'Siyah', Beden: 'M' }; null when empty. */
export function parseAttributes(text: string): Record<string, string> | null {
  const entries = text
    .split(/[,;\n]/)
    .map((part) => part.split('=').map((s) => s.trim()))
    .filter(([key, value]) => key && value)
    .map(([key, value]) => [key, value] as const);
  return entries.length ? Object.fromEntries(entries) : null;
}

export function formatAttributes(attributes: Record<string, string> | null | undefined): string {
  return Object.entries(attributes ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
}

/** Signed quantities (adjustments, count differences) in green/red. */
export function SignedQuantity({ value, unit }: { value: string; unit?: string }) {
  const number = Number(value);
  return (
    <span
      className={cn(
        'tabular-nums',
        number > 0 && 'text-emerald-600',
        number < 0 && 'text-destructive',
      )}
    >
      {number > 0 ? '+' : ''}
      {formatQuantity(value, unit)}
    </span>
  );
}

export function useWarehouseOptions(enabled = true, activeOnly = true): SelectOption[] {
  const { data } = useWarehousesFindAll({ query: { enabled } });
  return (data ?? [])
    .filter((w) => !activeOnly || w.isActive)
    .map((w) => ({ value: w.id, label: w.name }));
}

export function useProductCategoryOptions(enabled = true): SelectOption[] {
  const { data } = useProductCategoriesFindAll({ query: { enabled } });
  return (data ?? [])
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: c.parentName ? `${c.parentName} › ${c.name}` : c.name }));
}

interface ItemPickerProps {
  value: StockItemDto | null;
  onChange: (item: StockItemDto) => void;
  /** Shows on-hand quantities of this warehouse. */
  warehouseId?: string;
  /** Only offer items that are in stock in `warehouseId` (issues, transfers). */
  inStock?: boolean;
  /** Also offer services (trade documents). */
  includeServices?: boolean;
  placeholder?: string;
  className?: string;
}

/** Searchable item (variant) picker backed by `/stock/items`. */
export function ItemPicker({
  value,
  onChange,
  warehouseId,
  inStock,
  includeServices,
  placeholder,
  className,
}: ItemPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const { data, isFetching } = useStockFindItems(
    {
      search: debounced || undefined,
      warehouseId,
      inStock: inStock || undefined,
      includeServices: includeServices || undefined,
    },
    { query: { enabled: open } },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between font-normal', className)}
        >
          {value ? (
            <span className="truncate">
              <code className="text-muted-foreground mr-2 text-xs">{value.sku}</code>
              {itemName(value.productName, value.variantName)}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {placeholder ?? t('inventory.selectItem')}
            </span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t('inventory.searchItem')}
          />
          <CommandList>
            <CommandEmpty>{isFetching ? t('common.loading') : t('common.noResults')}</CommandEmpty>
            {(data ?? []).map((item) => (
              <CommandItem
                key={item.variantId}
                value={item.variantId}
                onSelect={() => {
                  onChange(item);
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(value?.variantId === item.variantId ? 'opacity-100' : 'opacity-0')}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{itemName(item.productName, item.variantName)}</div>
                  <code className="text-muted-foreground text-xs">{item.sku}</code>
                </div>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {item.productType === 'SERVICE'
                    ? t('inventory.types.SERVICE')
                    : formatQuantity(item.onHand, item.unitCode)}
                </span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
