import { Check, ChevronsUpDown, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export interface PickerOption {
  value: string;
  code: string;
  label: string;
}

export interface PickerGroup {
  heading?: string;
  options: PickerOption[];
}

/** Searchable select for long lists (accounts, partners); matches code and name. */
export function OptionPicker({
  value,
  onChange,
  groups,
  placeholder,
  clearable,
  invalid,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  groups: PickerGroup[];
  placeholder: string;
  clearable?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          className={cn(
            'w-full justify-between px-3 font-normal',
            !selected && 'text-muted-foreground',
            invalid && 'border-destructive',
          )}
        >
          <span className="truncate">
            {selected ? (
              <>
                <span className="font-mono">{selected.code}</span> {selected.label}
              </>
            ) : (
              placeholder
            )}
          </span>
          {clearable && selected ? (
            <X
              className="size-4 shrink-0 opacity-60 hover:opacity-100"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }}
            />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command
          filter={(itemValue, search) =>
            itemValue.toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')) ? 1 : 0
          }
        >
          <CommandInput placeholder={t('common.search')} />
          <CommandList>
            <CommandEmpty>{t('common.noResults')}</CommandEmpty>
            {groups.map((group, index) => (
              <CommandGroup key={group.heading ?? index} heading={group.heading}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={`${option.code} ${option.label} ${option.value}`}
                    onSelect={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn('size-4', option.value === value ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="font-mono text-xs">{option.code}</span>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
