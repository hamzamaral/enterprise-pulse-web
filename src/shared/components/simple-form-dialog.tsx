import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { ZodType, ZodTypeDef } from 'zod';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldConfig<T extends FieldValues> {
  name: Path<T>;
  label: string;
  type?: 'text' | 'email' | 'number' | 'date' | 'color' | 'switch' | 'select' | 'textarea';
  placeholder?: string;
  /** Spans both columns of the two-column grid. */
  wide?: boolean;
  disabled?: boolean;
  /** For `select`; an empty choice ("—") is offered unless `required` is set. */
  options?: SelectOption[];
  required?: boolean;
}

/** Radix Select cannot use "" as an item value, so the empty choice is mapped to this sentinel. */
const EMPTY = '__empty__';

interface SimpleFormDialogProps<T extends FieldValues> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: ZodType<T, ZodTypeDef, any>;
  fields: FieldConfig<T>[];
  defaultValues: DefaultValues<T>;
  pending?: boolean;
  onSubmit: (values: T) => void;
}

/** Declarative form dialog for simple reference-data screens. */
export function SimpleFormDialog<T extends FieldValues>({
  open,
  onOpenChange,
  title,
  schema,
  fields,
  defaultValues,
  pending,
  onSubmit,
}: SimpleFormDialogProps<T>) {
  const { t } = useTranslation();
  const form = useForm<T>({ resolver: zodResolver(schema as never) as Resolver<T>, defaultValues });

  useEffect(() => {
    if (open) form.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              {fields.map((config) => (
                <FormField
                  key={config.name}
                  control={form.control}
                  name={config.name}
                  render={({ field }) =>
                    config.type === 'switch' ? (
                      <FormItem
                        className={cn('flex items-center gap-3', config.wide && 'sm:col-span-2')}
                      >
                        <FormControl>
                          <Switch checked={!!field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="!mt-0">{config.label}</FormLabel>
                      </FormItem>
                    ) : config.type === 'select' ? (
                      <FormItem className={cn(config.wide && 'sm:col-span-2')}>
                        <FormLabel>{config.label}</FormLabel>
                        <Select
                          value={(field.value as string | null | undefined) || EMPTY}
                          onValueChange={(value) => field.onChange(value === EMPTY ? '' : value)}
                          disabled={config.disabled}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={config.placeholder} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {!config.required && (
                              <SelectItem value={EMPTY}>{t('common.none')}</SelectItem>
                            )}
                            {config.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    ) : config.type === 'textarea' ? (
                      <FormItem className={cn(config.wide && 'sm:col-span-2')}>
                        <FormLabel>{config.label}</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            placeholder={config.placeholder}
                            disabled={config.disabled}
                            {...field}
                            value={(field.value as string | undefined) ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    ) : (
                      <FormItem className={cn(config.wide && 'sm:col-span-2')}>
                        <FormLabel>{config.label}</FormLabel>
                        <FormControl>
                          <Input
                            className={cn(config.type === 'color' && 'h-9 w-20 p-1')}
                            type={config.type ?? 'text'}
                            placeholder={config.placeholder}
                            disabled={config.disabled}
                            {...field}
                            value={(field.value as string | number | undefined) ?? ''}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )
                  }
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
