import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { usePartnersFindAll } from '@/api/generated/endpoints/partners/partners';
import type { PartnerDto, PartnerType } from '@/api/generated/model';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';
import { formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/shared/ui/command';
import { FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

const TYPE_TONES: Record<PartnerType, Tone> = {
  CUSTOMER: 'info',
  SUPPLIER: 'warning',
  BOTH: 'success',
};

export function PartnerTypeBadge({ type }: { type: PartnerType }) {
  const { t } = useTranslation();
  return <ToneBadge tone={TYPE_TONES[type]}>{t(`partners.types.${type}`)}</ToneBadge>;
}

/**
 * Ledger balance in the Turkish convention: "(B)" when the partner owes us (borçlu),
 * "(A)" when we owe the partner (alacaklı).
 */
export function BalanceText({ value, currency }: { value: string; currency?: string }) {
  const { t } = useTranslation();
  const number = Number(value);
  if (!number) return <span className="text-muted-foreground tabular-nums">{formatMoney(0)}</span>;
  return (
    <span
      className={cn(
        'tabular-nums',
        number > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      {formatMoney(Math.abs(number), currency)}{' '}
      <span className="text-xs">
        {number > 0 ? t('partners.balanceDebit') : t('partners.balanceCredit')}
      </span>
    </span>
  );
}

export type PartnerOption = Pick<PartnerDto, 'id' | 'code' | 'title'> &
  Partial<Pick<PartnerDto, 'currencyCode' | 'paymentTermDays'>>;

interface PartnerPickerProps {
  value: PartnerOption | null;
  onChange: (partner: PartnerDto) => void;
  /** CUSTOMER or SUPPLIER; partners of type BOTH always match. */
  type?: PartnerType;
  disabled?: boolean;
  className?: string;
}

/** Searchable partner (cari) picker backed by `/partners`. */
export function PartnerPicker({ value, onChange, type, disabled, className }: PartnerPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 250);
  const { data, isFetching } = usePartnersFindAll(
    { search: debounced || undefined, type, isActive: true, pageSize: 20, sortBy: 'title' },
    { query: { enabled: open } },
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', className)}
        >
          {value ? (
            <span className="truncate">
              <code className="text-muted-foreground mr-2 text-xs">{value.code}</code>
              {value.title}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('partners.select')}</span>
          )}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t('partners.search')}
          />
          <CommandList>
            <CommandEmpty>{isFetching ? t('common.loading') : t('common.noResults')}</CommandEmpty>
            {(data?.data ?? []).map((partner) => (
              <CommandItem
                key={partner.id}
                value={partner.id}
                onSelect={() => {
                  onChange(partner);
                  setOpen(false);
                }}
              >
                <Check className={cn(value?.id === partner.id ? 'opacity-100' : 'opacity-0')} />
                <div className="min-w-0 flex-1">
                  <div className="truncate">{partner.title}</div>
                  <code className="text-muted-foreground text-xs">{partner.code}</code>
                </div>
                <BalanceText value={partner.balance} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** `PartnerPicker` bound to a form field holding a `PartnerOption | null`. */
export function PartnerField<T extends FieldValues>({
  control,
  name,
  label,
  type,
  disabled,
  onPicked,
}: {
  control: Control<T>;
  name: Path<T>;
  label: string;
  type?: PartnerType;
  disabled?: boolean;
  onPicked?: (partner: PartnerDto) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <PartnerPicker
            value={field.value as PartnerOption | null}
            type={type}
            disabled={disabled}
            onChange={(partner) => {
              field.onChange(partner);
              onPicked?.(partner);
            }}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
