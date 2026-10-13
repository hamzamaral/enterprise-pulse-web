import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useContractsActivate,
  useContractsRenew,
  useContractsTerminate,
} from '@/api/generated/endpoints/contracts/contracts';
import type { ContractDetailDto } from '@/api/generated/model';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate } from '@/shared/lib/format';
import { useInvalidateContracts } from './contract-components';

const today = () => new Date().toISOString().slice(0, 10);
const toNumber = (value: string) => Number(value.replace(',', '.'));

interface DialogProps {
  contract: ContractDetailDto;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useDone(onOpenChange: (open: boolean) => void, message: string) {
  const invalidate = useInvalidateContracts();
  return async () => {
    toast.success(message);
    await invalidate();
    onOpenChange(false);
  };
}

const activateSchema = z.object({ signedDate: z.string().min(1, 'validation.required') });

export function ActivateDialog({ contract, open, onOpenChange }: DialogProps) {
  const { t } = useTranslation();
  const activate = useContractsActivate();
  const onSuccess = useDone(onOpenChange, t('contracts.activated'));
  return (
    <SimpleFormDialog<z.infer<typeof activateSchema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('contracts.activateTitle')}
      description={<p className="text-muted-foreground text-sm">{t('contracts.activateHint')}</p>}
      schema={activateSchema}
      pending={activate.isPending}
      defaultValues={{ signedDate: contract.signedDate ?? today() }}
      fields={[{ name: 'signedDate', label: t('contracts.signedDate'), type: 'date' }]}
      onSubmit={(values) => activate.mutate({ id: contract.id, data: values }, { onSuccess })}
    />
  );
}

export function RenewDialog({ contract, open, onOpenChange }: DialogProps) {
  const { t } = useTranslation();
  const renew = useContractsRenew();
  const onSuccess = useDone(onOpenChange, t('contracts.renewed'));
  const schema = z.object({
    endDate: z
      .string()
      .min(1, 'validation.required')
      .refine(
        (value) => !contract.endDate || (value > contract.endDate && value >= today()),
        'contracts.validation.renewAfterEnd',
      ),
    amount: z
      .string()
      .trim()
      .refine((value) => !value || toNumber(value) >= 0, 'validation.number'),
    note: z.string().max(1000),
  });
  return (
    <SimpleFormDialog<z.infer<typeof schema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('contracts.renewTitle')}
      description={
        <p className="text-muted-foreground text-sm">
          {t('contracts.renewHint', { date: formatDate(contract.endDate) })}
        </p>
      }
      schema={schema}
      pending={renew.isPending}
      defaultValues={{
        endDate: contract.suggestedRenewalEnd ?? '',
        amount: contract.amount ? String(Number(contract.amount)) : '',
        note: '',
      }}
      fields={[
        { name: 'endDate', label: t('contracts.newEndDate'), type: 'date' },
        { name: 'amount', label: t('contracts.amount') },
        { name: 'note', label: t('contracts.note'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) =>
        renew.mutate(
          {
            id: contract.id,
            data: {
              endDate: values.endDate,
              amount: values.amount ? toNumber(values.amount) : undefined,
              note: values.note.trim() || undefined,
            },
          },
          { onSuccess },
        )
      }
    />
  );
}

export function TerminateDialog({ contract, open, onOpenChange }: DialogProps) {
  const { t } = useTranslation();
  const terminate = useContractsTerminate();
  const onSuccess = useDone(onOpenChange, t('contracts.terminated'));
  const schema = z.object({
    terminatedOn: z
      .string()
      .min(1, 'validation.required')
      .refine(
        (value) => value >= contract.startDate && (!contract.endDate || value <= contract.endDate),
        'contracts.validation.terminationRange',
      ),
    reason: z.string().trim().min(3, 'validation.required').max(1000),
  });
  return (
    <SimpleFormDialog<z.infer<typeof schema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('contracts.terminateTitle')}
      description={<p className="text-muted-foreground text-sm">{t('contracts.terminateHint')}</p>}
      schema={schema}
      pending={terminate.isPending}
      defaultValues={{ terminatedOn: today(), reason: '' }}
      fields={[
        { name: 'terminatedOn', label: t('contracts.terminatedOn'), type: 'date' },
        { name: 'reason', label: t('contracts.terminationReason'), type: 'textarea', wide: true },
      ]}
      onSubmit={(values) => terminate.mutate({ id: contract.id, data: values }, { onSuccess })}
    />
  );
}
