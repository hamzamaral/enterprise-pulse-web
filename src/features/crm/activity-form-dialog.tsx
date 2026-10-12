import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getCrmActivitiesFindAllQueryKey,
  getCrmSummaryQueryKey,
  useCrmActivitiesCreate,
  useCrmActivitiesUpdate,
} from '@/api/generated/endpoints/crm/crm';
import { CrmActivityType, type ActivityDto } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { SimpleFormDialog, type FieldConfig } from '@/shared/components/simple-form-dialog';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { fromLocalInput, toLocalInput, useMemberOptions } from './crm-components';

const schema = z.object({
  type: z.nativeEnum(CrmActivityType),
  subject: z.string().trim().min(2, 'validation.required'),
  dueAt: z.string(),
  ownerId: v.requiredString(),
  description: z.string(),
  done: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export interface ActivityLink {
  leadId?: string;
  opportunityId?: string;
  partnerId?: string;
}

/** Creates an activity (optionally linked to a lead, opportunity or customer) or edits one. */
export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  link,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity?: ActivityDto;
  link?: ActivityLink;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const invalidate = useInvalidate();
  const create = useCrmActivitiesCreate();
  const update = useCrmActivitiesUpdate();
  const members = useMemberOptions(open);

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getCrmActivitiesFindAllQueryKey(), getCrmSummaryQueryKey());
    onOpenChange(false);
  };

  const submit = (values: FormValues) => {
    const common = {
      type: values.type,
      subject: values.subject,
      description: values.description.trim() || null,
      dueAt: fromLocalInput(values.dueAt),
      ownerId: values.ownerId,
    };
    if (activity) update.mutate({ id: activity.id, data: common }, { onSuccess });
    else create.mutate({ data: { ...common, ...link, done: values.done } }, { onSuccess });
  };

  const fields: FieldConfig<FormValues>[] = [
    {
      name: 'type',
      label: t('crm.activities.type'),
      type: 'select',
      required: true,
      options: Object.values(CrmActivityType).map((type) => ({
        value: type,
        label: t(`crm.activities.types.${type}`),
      })),
    },
    { name: 'dueAt', label: t('crm.activities.dueAt'), type: 'datetime-local' },
    { name: 'subject', label: t('crm.activities.subject'), wide: true },
    {
      name: 'ownerId',
      label: t('crm.activities.assignee'),
      type: 'select',
      required: true,
      options: members,
      wide: true,
    },
    { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
  ];
  if (!activity) {
    fields.push({ name: 'done', label: t('crm.activities.logDone'), type: 'switch', wide: true });
  }

  return (
    <SimpleFormDialog<FormValues>
      open={open}
      onOpenChange={onOpenChange}
      title={activity ? t('crm.activities.edit') : t('crm.activities.new')}
      schema={schema}
      pending={create.isPending || update.isPending}
      defaultValues={{
        type: activity?.type ?? CrmActivityType.TASK,
        subject: activity?.subject ?? '',
        dueAt: toLocalInput(activity?.dueAt),
        ownerId: activity?.ownerId ?? me?.user.id ?? '',
        description: activity?.description ?? '',
        done: false,
      }}
      fields={fields}
      onSubmit={submit}
    />
  );
}
