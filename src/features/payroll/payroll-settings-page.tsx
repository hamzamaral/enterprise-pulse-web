import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, useForm, type Control, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  usePayrollParametersFindAll,
  usePayrollParametersFindOne,
  usePayrollParametersUpdate,
} from '@/api/generated/endpoints/payroll/payroll';
import type { PayrollParameterDto } from '@/api/generated/model';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { useInvalidatePayroll } from './payroll-components';

const CURRENT_YEAR = new Date().getFullYear();
const number = () => z.coerce.number({ invalid_type_error: 'validation.number' });
const percent = (max = 100) => number().min(0).max(max);

const schema = z
  .object({
    minimumWage: number().min(1),
    sgkCeiling: number().min(1),
    sgkEmployeeRate: percent(),
    unemploymentEmployeeRate: percent(),
    sgkEmployerRate: percent(),
    unemploymentEmployerRate: percent(),
    stampTaxRate: percent(10),
    overtimeRate: number().min(1).max(5),
    monthlyHours: number().int().min(100).max(300),
    taxBrackets: z
      .array(z.object({ upTo: z.string(), rate: z.string() }))
      .min(1)
      .max(10),
  })
  .superRefine((values, ctx) => {
    if (values.sgkCeiling < values.minimumWage) {
      ctx.addIssue({
        code: 'custom',
        path: ['sgkCeiling'],
        message: 'payroll.parameters.ceilingBelowMinimum',
      });
    }
    let previous = 0;
    values.taxBrackets.forEach((bracket, index) => {
      const rate = Number(bracket.rate);
      if (bracket.rate.trim() === '' || !(rate >= 0 && rate <= 100)) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxBrackets', index, 'rate'],
          message: 'validation.number',
        });
      }
      if (index === values.taxBrackets.length - 1) return;
      const upTo = Number(bracket.upTo);
      if (bracket.upTo.trim() === '' || !(upTo > previous)) {
        ctx.addIssue({
          code: 'custom',
          path: ['taxBrackets', index, 'upTo'],
          message: 'payroll.parameters.bracketOrder',
        });
      }
      previous = upTo;
    });
  });
type Values = z.infer<typeof schema>;

const toValues = (data: PayrollParameterDto): Values => ({
  minimumWage: Number(data.minimumWage),
  sgkCeiling: Number(data.sgkCeiling),
  sgkEmployeeRate: Number(data.sgkEmployeeRate),
  unemploymentEmployeeRate: Number(data.unemploymentEmployeeRate),
  sgkEmployerRate: Number(data.sgkEmployerRate),
  unemploymentEmployerRate: Number(data.unemploymentEmployerRate),
  stampTaxRate: Number(data.stampTaxRate),
  overtimeRate: Number(data.overtimeRate),
  monthlyHours: data.monthlyHours,
  taxBrackets: data.taxBrackets.map((bracket) => ({
    upTo: bracket.upTo === null ? '' : String(Number(bracket.upTo)),
    rate: String(Number(bracket.rate)),
  })),
});

function NumberField({
  control,
  name,
  label,
  suffix,
}: {
  control: Control<Values>;
  name: FieldPath<Values>;
  label: string;
  suffix?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                type="number"
                step="any"
                className={suffix ? 'pr-12' : undefined}
                {...field}
                value={field.value as number}
              />
            </FormControl>
            {suffix && (
              <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                {suffix}
              </span>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

/** Mounted per year, so switching years starts from that year's stored values. */
function ParametersForm({ data }: { data: PayrollParameterDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePayroll();
  const update = usePayrollParametersUpdate();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(data) });
  const brackets = useFieldArray({ control: form.control, name: 'taxBrackets' });
  const { control } = form;

  const submit = (values: Values) =>
    update.mutate(
      {
        year: data.year,
        data: {
          ...values,
          taxBrackets: values.taxBrackets.map((bracket, index) => ({
            upTo: index === values.taxBrackets.length - 1 ? null : Number(bracket.upTo),
            rate: Number(bracket.rate),
          })),
        },
      },
      {
        onSuccess: async (saved) => {
          toast.success(t('common.saved'));
          form.reset(toValues(saved));
          await invalidate();
        },
      },
    );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
        {data.usedByPeriods && (
          <p className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="size-4 shrink-0" />
            {t('payroll.parameters.usedByPeriods')}
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.parameters.wages')}</CardTitle>
              <CardDescription>{t('payroll.parameters.wagesHint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField
                control={control}
                name="minimumWage"
                label={t('payroll.parameters.minimumWage')}
              />
              <NumberField
                control={control}
                name="sgkCeiling"
                label={t('payroll.parameters.sgkCeiling')}
              />
              <NumberField
                control={control}
                name="overtimeRate"
                label={t('payroll.parameters.overtimeRate')}
                suffix="×"
              />
              <NumberField
                control={control}
                name="monthlyHours"
                label={t('payroll.parameters.monthlyHours')}
                suffix={t('payroll.parameters.hours')}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('payroll.parameters.rates')}</CardTitle>
              <CardDescription>{t('payroll.parameters.ratesHint')}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <NumberField
                control={control}
                name="sgkEmployeeRate"
                label={t('payroll.sgkEmployee')}
                suffix="%"
              />
              <NumberField
                control={control}
                name="unemploymentEmployeeRate"
                label={t('payroll.unemploymentEmployee')}
                suffix="%"
              />
              <NumberField
                control={control}
                name="sgkEmployerRate"
                label={t('payroll.sgkEmployer')}
                suffix="%"
              />
              <NumberField
                control={control}
                name="unemploymentEmployerRate"
                label={t('payroll.unemploymentEmployer')}
                suffix="%"
              />
              <NumberField
                control={control}
                name="stampTaxRate"
                label={t('payroll.stampTax')}
                suffix="%"
              />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('payroll.parameters.brackets')}</CardTitle>
            <CardDescription>{t('payroll.parameters.bracketsHint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {brackets.fields.map((bracket, index) => {
              const last = index === brackets.fields.length - 1;
              return (
                <div
                  key={bracket.id}
                  className="grid grid-cols-[1fr_8rem_2.5rem] items-start gap-3"
                >
                  <FormField
                    control={control}
                    name={`taxBrackets.${index}.upTo`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">{t('payroll.parameters.upTo')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="any"
                            disabled={last}
                            placeholder={
                              last
                                ? t('payroll.parameters.topBracket')
                                : t('payroll.parameters.upTo')
                            }
                            {...field}
                            value={last ? '' : field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name={`taxBrackets.${index}.rate`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">{t('payroll.parameters.rate')}</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input type="number" step="any" className="pr-8" {...field} />
                          </FormControl>
                          <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
                            %
                          </span>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    aria-label={t('common.delete')}
                    disabled={brackets.fields.length === 1}
                    onClick={() => brackets.remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={brackets.fields.length >= 10}
              onClick={() => brackets.insert(brackets.fields.length - 1, { upTo: '', rate: '' })}
            >
              <Plus /> {t('payroll.parameters.addBracket')}
            </Button>
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!form.formState.isDirty}
            onClick={() => form.reset()}
          >
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export function PayrollSettingsPage() {
  const { t } = useTranslation();
  const [year, setYear] = useState(CURRENT_YEAR);
  const { data: saved } = usePayrollParametersFindAll();
  const { data } = usePayrollParametersFindOne(year);
  const years = [
    ...new Set([
      ...(saved ?? []).map((row) => row.year),
      CURRENT_YEAR - 1,
      CURRENT_YEAR,
      CURRENT_YEAR + 1,
    ]),
  ].sort((a, b) => b - a);

  return (
    <>
      <PageHeader
        title={t('payroll.parameters.title')}
        description={t('payroll.parameters.subtitle')}
        actions={
          <>
            {data && (
              <ToneBadge tone={data.saved ? 'success' : 'neutral'}>
                {data.saved ? t('payroll.parameters.saved') : t('payroll.parameters.defaults')}
              </ToneBadge>
            )}
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      {data && data.year === year ? (
        <ParametersForm key={year} data={data} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}
    </>
  );
}
