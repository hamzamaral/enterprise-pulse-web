import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useJobApplicationsCreate } from '@/api/generated/endpoints/recruitment/recruitment';
import type { JobApplicationDetailDto } from '@/api/generated/model';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { v } from '@/shared/lib/validation';
import {
  useActivePostingOptions,
  useCandidateOptions,
  useInvalidateRecruitment,
} from './recruitment-components';

const schema = z.object({ target: v.requiredString(), note: z.string() });
type FormValues = z.infer<typeof schema>;

/** Adds an application: pick a candidate for a posting, or a posting for a candidate. */
export function ApplyDialog({
  open,
  onOpenChange,
  postingId,
  candidateId,
  excludeIds = [],
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postingId?: string;
  candidateId?: string;
  /** Candidates (or postings) that already have an application. */
  excludeIds?: string[];
  onSaved?: (application: JobApplicationDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const create = useJobApplicationsCreate();
  const candidates = useCandidateOptions(open && !!postingId);
  const postings = useActivePostingOptions(open && !!candidateId);
  const options = (postingId ? candidates : postings).filter((o) => !excludeIds.includes(o.value));

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={t('recruitment.applications.new')}
      schema={schema}
      pending={create.isPending}
      defaultValues={{ target: '', note: '' }}
      fields={[
        {
          name: 'target',
          label: postingId ? t('recruitment.candidate') : t('recruitment.posting'),
          type: 'select',
          required: true,
          options,
          wide: true,
        },
        { name: 'note', label: t('recruitment.applications.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        create.mutate(
          {
            data: {
              postingId: postingId ?? values.target,
              candidateId: candidateId ?? values.target,
              note: values.note.trim() || undefined,
            },
          },
          {
            onSuccess: async (saved) => {
              toast.success(t('recruitment.applications.created'));
              await invalidate();
              onOpenChange(false);
              onSaved?.(saved);
            },
          },
        )
      }
    />
  );
}
