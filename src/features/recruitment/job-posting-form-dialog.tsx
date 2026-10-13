import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useBranchesFindAll } from '@/api/generated/endpoints/branches/branches';
import {
  useJobPostingsCreate,
  useJobPostingsUpdate,
} from '@/api/generated/endpoints/recruitment/recruitment';
import { EmploymentType, type JobPostingDetailDto } from '@/api/generated/model';
import {
  emptyToNull,
  useDepartmentOptions,
  useEmployeeOptions,
  usePositionOptions,
} from '@/features/hr/hr-components';
import { SimpleFormDialog, type FieldConfig } from '@/shared/components/simple-form-dialog';
import { useInvalidateRecruitment } from './recruitment-components';

const optionalAmount = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number({ invalid_type_error: 'validation.number' }).min(0).nullable(),
);

const schema = z
  .object({
    title: z.string().trim().min(2, 'validation.required'),
    departmentId: z.string(),
    positionId: z.string(),
    branchId: z.string(),
    employmentType: z.nativeEnum(EmploymentType),
    location: z.string(),
    openings: z.coerce
      .number({ invalid_type_error: 'validation.number' })
      .int()
      .min(1, 'validation.number')
      .max(100),
    hiringManagerId: z.string(),
    salaryMin: optionalAmount,
    salaryMax: optionalAmount,
    closesAt: z.string(),
    publish: z.boolean(),
    description: z.string(),
    requirements: z.string(),
  })
  .refine((d) => d.salaryMin === null || d.salaryMax === null || d.salaryMin <= d.salaryMax, {
    path: ['salaryMax'],
    message: 'recruitment.postings.salaryRangeInvalid',
  });
type FormValues = z.infer<typeof schema>;

export function JobPostingFormDialog({
  open,
  onOpenChange,
  posting,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posting?: JobPostingDetailDto;
  onSaved?: (posting: JobPostingDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const create = useJobPostingsCreate();
  const update = useJobPostingsUpdate();
  const departments = useDepartmentOptions(open);
  const positions = usePositionOptions(open);
  const employees = useEmployeeOptions(open);
  const { data: branches } = useBranchesFindAll({ pageSize: 100 }, { query: { enabled: open } });

  const onSuccess = async (saved: JobPostingDetailDto) => {
    toast.success(
      posting ? t('common.saved') : t('recruitment.postings.created', { number: saved.number }),
    );
    await invalidate();
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const data = {
      title: values.title,
      departmentId: emptyToNull(values.departmentId),
      positionId: emptyToNull(values.positionId),
      branchId: emptyToNull(values.branchId),
      employmentType: values.employmentType,
      location: emptyToNull(values.location.trim()),
      openings: values.openings,
      hiringManagerId: emptyToNull(values.hiringManagerId),
      salaryMin: values.salaryMin,
      salaryMax: values.salaryMax,
      closesAt: emptyToNull(values.closesAt),
      description: emptyToNull(values.description.trim()),
      requirements: emptyToNull(values.requirements.trim()),
    };
    if (posting) update.mutate({ id: posting.id, data }, { onSuccess });
    else {
      create.mutate(
        { data: { ...data, status: values.publish ? 'OPEN' : 'DRAFT' } },
        { onSuccess },
      );
    }
  };

  const fields: FieldConfig<FormValues>[] = [
    { name: 'title', label: t('recruitment.postings.titleField'), wide: true },
    {
      name: 'departmentId',
      label: t('employees.department'),
      type: 'select',
      options: departments,
    },
    { name: 'positionId', label: t('employees.position'), type: 'select', options: positions },
    {
      name: 'branchId',
      label: t('employees.branch'),
      type: 'select',
      options: (branches?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
    },
    {
      name: 'employmentType',
      label: t('employees.employmentType'),
      type: 'select',
      required: true,
      options: Object.values(EmploymentType).map((value) => ({
        value,
        label: t(`employees.employmentTypes.${value}`),
      })),
    },
    { name: 'location', label: t('recruitment.postings.location') },
    { name: 'openings', label: t('recruitment.postings.openings'), type: 'number' },
    {
      name: 'hiringManagerId',
      label: t('recruitment.postings.hiringManager'),
      type: 'select',
      options: employees,
    },
    { name: 'closesAt', label: t('recruitment.postings.closesAt'), type: 'date' },
    { name: 'salaryMin', label: t('recruitment.postings.salaryMin'), type: 'number' },
    { name: 'salaryMax', label: t('recruitment.postings.salaryMax'), type: 'number' },
    { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
    {
      name: 'requirements',
      label: t('recruitment.postings.requirements'),
      type: 'textarea',
      wide: true,
    },
  ];
  if (!posting) {
    fields.push({ name: 'publish', label: t('recruitment.postings.publishNow'), type: 'switch' });
  }

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={posting ? `${posting.number} · ${posting.title}` : t('recruitment.postings.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        title: posting?.title ?? '',
        departmentId: posting?.departmentId ?? '',
        positionId: posting?.positionId ?? '',
        branchId: posting?.branchId ?? '',
        employmentType: posting?.employmentType ?? 'FULL_TIME',
        location: posting?.location ?? '',
        openings: posting?.openings ?? 1,
        hiringManagerId: posting?.hiringManagerId ?? '',
        salaryMin: posting?.salaryMin ? Number(posting.salaryMin) : null,
        salaryMax: posting?.salaryMax ? Number(posting.salaryMax) : null,
        closesAt: posting?.closesAt ?? '',
        publish: true,
        description: posting?.description ?? '',
        requirements: posting?.requirements ?? '',
      }}
      fields={fields}
      onSubmit={submit}
    />
  );
}
