import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useTicketsCreate } from '@/api/generated/endpoints/support/support';
import { TicketPriority, type TicketDetailDto } from '@/api/generated/model';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { PRIORITIES, useCategoryOptions, useInvalidateSupport } from './support-components';

const schema = z.object({
  subject: z.string().trim().min(3, 'validation.required').max(200),
  categoryId: z.string(),
  priority: z.nativeEnum(TicketPriority),
  description: z.string().trim().min(3, 'validation.required').max(10000),
});
type Values = z.infer<typeof schema>;

export function TicketFormDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (ticket: TicketDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const categories = useCategoryOptions();
  const create = useTicketsCreate();

  return (
    <SimpleFormDialog<Values>
      open={open}
      onOpenChange={onOpenChange}
      title={t('support.new')}
      description={<p className="text-muted-foreground text-sm">{t('support.newHint')}</p>}
      schema={schema}
      pending={create.isPending}
      defaultValues={{
        subject: '',
        categoryId: '',
        priority: TicketPriority.MEDIUM,
        description: '',
      }}
      fields={[
        {
          name: 'subject',
          label: t('support.subject'),
          placeholder: t('support.subjectPlaceholder'),
          wide: true,
        },
        { name: 'categoryId', label: t('support.category'), type: 'select', options: categories },
        {
          name: 'priority',
          label: t('support.priorityLabel'),
          type: 'select',
          required: true,
          options: PRIORITIES.map((value) => ({
            value,
            label: t(`support.priority.${value}`),
          })),
        },
        {
          name: 'description',
          label: t('common.description'),
          type: 'textarea',
          placeholder: t('support.descriptionPlaceholder'),
          wide: true,
        },
      ]}
      onSubmit={({ categoryId, ...rest }) =>
        create.mutate(
          { data: { ...rest, categoryId: categoryId || null } },
          {
            onSuccess: async (ticket) => {
              toast.success(t('support.created', { number: ticket.number }));
              onOpenChange(false);
              await invalidate();
              onSaved?.(ticket);
            },
          },
        )
      }
    />
  );
}
