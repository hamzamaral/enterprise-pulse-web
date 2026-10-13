import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useTrainingCoursesFindAll,
  useTrainingSessionsCreate,
  useTrainingSessionsUpdate,
} from '@/api/generated/endpoints/training/training';
import type { TrainingSessionDetailDto } from '@/api/generated/model';
import { fromLocalInput, toLocalInput } from '@/features/crm/crm-components';
import { emptyToNull } from '@/features/hr/hr-components';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { v } from '@/shared/lib/validation';
import { useInvalidateTraining } from './training-components';

const optionalNumber = (min: number, max: number, integer = false) => {
  const number = z.coerce.number({ invalid_type_error: 'validation.number' }).min(min).max(max);
  return z.union([z.literal(''), integer ? number.int() : number]);
};

const schema = z
  .object({
    courseId: v.requiredString(),
    startsAt: v.requiredString(),
    endsAt: v.requiredString(),
    location: z.string(),
    instructor: z.string(),
    capacity: optionalNumber(1, 1000, true),
    cost: optionalNumber(0, 100_000_000),
    selfEnrollment: z.boolean(),
    notes: z.string(),
  })
  .refine((value) => value.endsAt > value.startsAt, {
    path: ['endsAt'],
    message: 'validation.dateRange',
  });
type Values = z.infer<typeof schema>;

/** A start next week at 09:30, ending at 17:30 the same day. */
function defaultTimes() {
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(9, 30, 0, 0);
  const end = new Date(start);
  end.setHours(17, 30, 0, 0);
  return { startsAt: toLocalInput(start.toISOString()), endsAt: toLocalInput(end.toISOString()) };
}

export function TrainingSessionFormDialog({
  open,
  onOpenChange,
  session,
  courseId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session?: TrainingSessionDetailDto;
  /** Preselected course for a new session. */
  courseId?: string;
  onSaved?: (session: TrainingSessionDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const create = useTrainingSessionsCreate();
  const update = useTrainingSessionsUpdate();
  const { data: courses } = useTrainingCoursesFindAll(
    { active: 'true' },
    { query: { enabled: open && !session } },
  );
  const times = defaultTimes();

  const onSuccess = async (saved: TrainingSessionDetailDto) => {
    toast.success(session ? t('common.saved') : t('training.sessions.created'));
    await invalidate();
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = ({ courseId: course, startsAt, endsAt, capacity, cost, ...rest }: Values) => {
    const data = {
      startsAt: fromLocalInput(startsAt) ?? '',
      endsAt: fromLocalInput(endsAt) ?? '',
      location: emptyToNull(rest.location),
      instructor: emptyToNull(rest.instructor),
      notes: emptyToNull(rest.notes),
      capacity: capacity === '' ? null : capacity,
      cost: cost === '' ? null : cost,
      selfEnrollment: rest.selfEnrollment,
    };
    if (session) update.mutate({ id: session.id, data }, { onSuccess });
    else create.mutate({ data: { ...data, courseId: course } }, { onSuccess });
  };

  return (
    <SimpleFormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={session ? session.courseTitle : t('training.sessions.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        courseId: session?.courseId ?? courseId ?? '',
        startsAt: session ? toLocalInput(session.startsAt) : times.startsAt,
        endsAt: session ? toLocalInput(session.endsAt) : times.endsAt,
        location: session?.location ?? '',
        instructor: session?.instructor ?? '',
        capacity: session?.capacity ?? '',
        cost: session?.cost === null || session?.cost === undefined ? '' : Number(session.cost),
        selfEnrollment: session?.selfEnrollment ?? false,
        notes: session?.notes ?? '',
      }}
      fields={[
        {
          name: 'courseId',
          label: t('training.course'),
          type: 'select',
          required: true,
          wide: true,
          disabled: !!session,
          options: session
            ? [{ value: session.courseId, label: `${session.courseCode} · ${session.courseTitle}` }]
            : (courses ?? []).map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` })),
        },
        { name: 'startsAt', label: t('training.sessions.startsAt'), type: 'datetime-local' },
        { name: 'endsAt', label: t('training.sessions.endsAt'), type: 'datetime-local' },
        { name: 'location', label: t('training.sessions.location') },
        { name: 'instructor', label: t('training.sessions.instructor') },
        { name: 'capacity', label: t('training.sessions.capacity'), type: 'number' },
        { name: 'cost', label: t('training.sessions.cost'), type: 'number' },
        {
          name: 'selfEnrollment',
          label: t('training.sessions.selfEnrollment'),
          type: 'switch',
          wide: true,
        },
        { name: 'notes', label: t('common.notes'), type: 'textarea', wide: true },
      ]}
      onSubmit={submit}
    />
  );
}
