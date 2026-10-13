import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  jobApplicationsCreate,
  useCandidatesCreate,
  useCandidatesUpdate,
} from '@/api/generated/endpoints/recruitment/recruitment';
import { CandidateSource, type CandidateDetailDto } from '@/api/generated/model';
import { getErrorMessage } from '@/api/http';
import { emptyToNull, useEmployeeOptions } from '@/features/hr/hr-components';
import { SimpleFormDialog, type FieldConfig } from '@/shared/components/simple-form-dialog';
import { v } from '@/shared/lib/validation';
import { useInvalidateRecruitment } from './recruitment-components';

const schema = z.object({
  firstName: v.requiredString(),
  lastName: v.requiredString(),
  email: v.email(),
  phone: z.string(),
  city: z.string(),
  source: z.nativeEnum(CandidateSource),
  currentTitle: z.string(),
  currentCompany: z.string(),
  linkedinUrl: z.union([z.literal(''), z.string().trim().url('recruitment.candidates.urlInvalid')]),
  expectedSalary: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number({ invalid_type_error: 'validation.number' }).positive('validation.number').nullable(),
  ),
  referredById: z.string(),
  notes: z.string(),
});
type FormValues = z.infer<typeof schema>;

/** Creates or edits a candidate; with `applyToPostingId` a new candidate also applies to it. */
export function CandidateFormDialog({
  open,
  onOpenChange,
  candidate,
  applyToPostingId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate?: CandidateDetailDto;
  applyToPostingId?: string;
  onSaved?: (candidate: CandidateDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const create = useCandidatesCreate();
  const update = useCandidatesUpdate();
  const employees = useEmployeeOptions(open);

  const onSuccess = async (saved: CandidateDetailDto) => {
    if (!candidate && applyToPostingId) {
      try {
        await jobApplicationsCreate({ postingId: applyToPostingId, candidateId: saved.id });
      } catch (error) {
        toast.error(getErrorMessage(error));
      }
    }
    toast.success(candidate ? t('common.saved') : t('recruitment.candidates.created'));
    await invalidate();
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const data = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: emptyToNull(values.phone.trim()),
      city: emptyToNull(values.city.trim()),
      source: values.source,
      currentTitle: emptyToNull(values.currentTitle.trim()),
      currentCompany: emptyToNull(values.currentCompany.trim()),
      linkedinUrl: emptyToNull(values.linkedinUrl.trim()),
      expectedSalary: values.expectedSalary,
      referredById: emptyToNull(values.referredById),
      notes: emptyToNull(values.notes.trim()),
    };
    if (candidate) update.mutate({ id: candidate.id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };

  const fields: FieldConfig<FormValues>[] = [
    { name: 'firstName', label: t('recruitment.candidates.firstName') },
    { name: 'lastName', label: t('recruitment.candidates.lastName') },
    { name: 'email', label: t('common.email'), type: 'email' },
    { name: 'phone', label: t('common.phone') },
    { name: 'currentTitle', label: t('recruitment.candidates.currentTitle') },
    { name: 'currentCompany', label: t('recruitment.candidates.currentCompany') },
    { name: 'city', label: t('common.city') },
    {
      name: 'source',
      label: t('recruitment.candidates.source'),
      type: 'select',
      required: true,
      options: Object.values(CandidateSource).map((value) => ({
        value,
        label: t(`recruitment.sources.${value}`),
      })),
    },
    { name: 'expectedSalary', label: t('recruitment.candidates.expectedSalary'), type: 'number' },
    {
      name: 'referredById',
      label: t('recruitment.candidates.referredBy'),
      type: 'select',
      options: employees,
    },
    { name: 'linkedinUrl', label: t('recruitment.candidates.linkedin'), wide: true },
    { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
  ];

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={candidate ? candidate.fullName : t('recruitment.candidates.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        firstName: candidate?.firstName ?? '',
        lastName: candidate?.lastName ?? '',
        email: candidate?.email ?? '',
        phone: candidate?.phone ?? '',
        city: candidate?.city ?? '',
        source: candidate?.source ?? 'CAREER_SITE',
        currentTitle: candidate?.currentTitle ?? '',
        currentCompany: candidate?.currentCompany ?? '',
        linkedinUrl: candidate?.linkedinUrl ?? '',
        expectedSalary: candidate?.expectedSalary ? Number(candidate.expectedSalary) : null,
        referredById: candidate?.referredById ?? '',
        notes: candidate?.notes ?? '',
      }}
      fields={fields}
      onSubmit={submit}
    />
  );
}
