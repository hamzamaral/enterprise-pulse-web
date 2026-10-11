import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, type Control, type FieldPath } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useBranchesFindAll } from '@/api/generated/endpoints/branches/branches';
import {
  getEmployeesFindAllQueryKey,
  getEmployeesFindOneQueryKey,
  useEmployeesCreate,
  useEmployeesUpdate,
} from '@/api/generated/endpoints/employees/employees';
import { useUsersFindAll } from '@/api/generated/endpoints/users/users';
import {
  EmploymentType,
  Gender,
  type EmployeeDetailDto,
  type UpdateEmployeeDto,
} from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import {
  emptyToNull,
  useDepartmentOptions,
  useEmployeeOptions,
  usePositionOptions,
} from './hr-components';

const EMPTY = '__empty__';

const schema = z.object({
  firstName: v.requiredString(),
  lastName: v.requiredString(),
  nationalId: z
    .string()
    .trim()
    .regex(/^([1-9]\d{10})?$/, 'validation.nationalId'),
  email: z.union([z.literal(''), z.string().trim().email('validation.email')]),
  phone: z.string().trim(),
  birthDate: z.string(),
  gender: z.string(),
  hireDate: v.requiredString(),
  employmentType: z.nativeEnum(EmploymentType),
  branchId: z.string(),
  departmentId: z.string(),
  positionId: z.string(),
  managerId: z.string(),
  userId: z.string(),
  address: z.string(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
});
type FormValues = z.infer<typeof schema>;

function SelectField({
  control,
  name,
  label,
  options,
  required,
  description,
}: {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
  options: SelectOption[];
  required?: boolean;
  description?: string;
}) {
  const { t } = useTranslation();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value || EMPTY}
            onValueChange={(value) => field.onChange(value === EMPTY ? '' : value)}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {!required && <SelectItem value={EMPTY}>{t('common.none')}</SelectItem>}
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextField({
  control,
  name,
  label,
  type = 'text',
  wide,
}: {
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  label: string;
  type?: string;
  wide?: boolean;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={wide ? 'sm:col-span-2' : undefined}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: EmployeeDetailDto | null;
  onSaved?: (employee: EmployeeDetailDto) => void;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  onSaved,
}: EmployeeFormDialogProps) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidate();
  const create = useEmployeesCreate();
  const update = useEmployeesUpdate();
  const departmentOptions = useDepartmentOptions(open);
  const positionOptions = usePositionOptions(open);
  const managerOptions = useEmployeeOptions(open).filter((o) => o.value !== employee?.id);
  const { data: branches } = useBranchesFindAll({ pageSize: 100 }, { query: { enabled: open } });
  const canLinkUser = can('users:read');
  const { data: users } = useUsersFindAll(
    { pageSize: 100, isActive: 'true', sortBy: 'firstName', sortOrder: 'asc' },
    { query: { enabled: open && canLinkUser } },
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      firstName: employee?.firstName ?? '',
      lastName: employee?.lastName ?? '',
      nationalId: employee?.nationalId ?? '',
      email: employee?.email ?? '',
      phone: employee?.phone ?? '',
      birthDate: employee?.birthDate ?? '',
      gender: employee?.gender ?? '',
      hireDate: employee?.hireDate ?? new Date().toISOString().slice(0, 10),
      employmentType: employee?.employmentType ?? EmploymentType.FULL_TIME,
      branchId: employee?.branchId ?? '',
      departmentId: employee?.departmentId ?? '',
      positionId: employee?.positionId ?? '',
      managerId: employee?.managerId ?? '',
      userId: employee?.userId ?? '',
      address: employee?.address ?? '',
      emergencyContactName: employee?.emergencyContactName ?? '',
      emergencyContactPhone: employee?.emergencyContactPhone ?? '',
    });
  }, [open, employee, form]);

  const onSuccess = async (saved: EmployeeDetailDto) => {
    toast.success(t('common.saved'));
    await invalidate(getEmployeesFindAllQueryKey(), getEmployeesFindOneQueryKey(saved.id));
    onOpenChange(false);
    onSaved?.(saved);
  };

  const onSubmit = (values: FormValues) => {
    const data: UpdateEmployeeDto = {
      firstName: values.firstName,
      lastName: values.lastName,
      hireDate: values.hireDate,
      employmentType: values.employmentType,
      nationalId: emptyToNull(values.nationalId),
      email: emptyToNull(values.email),
      phone: emptyToNull(values.phone),
      birthDate: emptyToNull(values.birthDate),
      gender: (emptyToNull(values.gender) as Gender | null) ?? null,
      branchId: emptyToNull(values.branchId),
      departmentId: emptyToNull(values.departmentId),
      positionId: emptyToNull(values.positionId),
      managerId: emptyToNull(values.managerId),
      address: emptyToNull(values.address),
      emergencyContactName: emptyToNull(values.emergencyContactName),
      emergencyContactPhone: emptyToNull(values.emergencyContactPhone),
      ...(canLinkUser ? { userId: emptyToNull(values.userId) } : {}),
    };
    if (employee) {
      update.mutate({ id: employee.id, data }, { onSuccess });
    } else {
      create.mutate(
        {
          data: {
            ...data,
            firstName: values.firstName,
            lastName: values.lastName,
            hireDate: values.hireDate,
          },
        },
        { onSuccess },
      );
    }
  };

  const pending = create.isPending || update.isPending;
  const { control } = form;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {employee ? `${t('employees.edit')} · ${employee.employeeNo}` : t('employees.new')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <section className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                {t('employees.personal')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={control} name="firstName" label={t('employees.firstName')} />
                <TextField control={control} name="lastName" label={t('employees.lastName')} />
                <TextField control={control} name="nationalId" label={t('employees.nationalId')} />
                <TextField
                  control={control}
                  name="birthDate"
                  label={t('employees.birthDate')}
                  type="date"
                />
                <SelectField
                  control={control}
                  name="gender"
                  label={t('employees.gender')}
                  options={Object.values(Gender).map((g) => ({
                    value: g,
                    label: t(`employees.genders.${g}`),
                  }))}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                {t('employees.employment')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  control={control}
                  name="hireDate"
                  label={t('employees.hireDate')}
                  type="date"
                />
                <SelectField
                  control={control}
                  name="employmentType"
                  label={t('employees.employmentType')}
                  required
                  options={Object.values(EmploymentType).map((type) => ({
                    value: type,
                    label: t(`employees.employmentTypes.${type}`),
                  }))}
                />
                <SelectField
                  control={control}
                  name="departmentId"
                  label={t('employees.department')}
                  options={departmentOptions}
                />
                <SelectField
                  control={control}
                  name="positionId"
                  label={t('employees.position')}
                  options={positionOptions}
                />
                <SelectField
                  control={control}
                  name="managerId"
                  label={t('employees.manager')}
                  options={managerOptions}
                />
                <SelectField
                  control={control}
                  name="branchId"
                  label={t('employees.branch')}
                  options={(branches?.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
                />
                {canLinkUser && (
                  <SelectField
                    control={control}
                    name="userId"
                    label={t('employees.user')}
                    description={t('employees.userHint')}
                    options={(users?.data ?? []).map((u) => ({
                      value: u.id,
                      label: `${u.firstName} ${u.lastName} · ${u.email}`,
                    }))}
                  />
                )}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-muted-foreground text-sm font-medium">
                {t('employees.contact')}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField control={control} name="email" label={t('common.email')} type="email" />
                <TextField control={control} name="phone" label={t('common.phone')} />
                <TextField
                  control={control}
                  name="emergencyContactName"
                  label={t('employees.emergencyContactName')}
                />
                <TextField
                  control={control}
                  name="emergencyContactPhone"
                  label={t('employees.emergencyContactPhone')}
                />
                <FormField
                  control={control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('common.address')}</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

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
