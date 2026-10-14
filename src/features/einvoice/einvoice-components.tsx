import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useEInvoiceRespond,
  useEInvoiceSend,
  useEInvoiceSettings,
  useEInvoiceSimulateIncoming,
  useEInvoiceSimulateResponse,
  useEInvoiceUpdateSettings,
} from '@/api/generated/endpoints/e-invoice/e-invoice';
import { usePartnersFindAll } from '@/api/generated/endpoints/partners/partners';
import {
  EInvoiceProfile,
  type EInvoiceDetailDto,
  type EInvoiceDirection,
  type EInvoiceStatus,
} from '@/api/generated/model';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ToneBadge } from '@/shared/components/status-badge';
import { STATUS_TONES } from './einvoice-rules';

const AUTO = 'AUTO';

export function EInvoiceStatusBadge({ status }: { status: EInvoiceStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`einvoice.status.${status}`)}</ToneBadge>;
}

export function ProfileBadge({ profile }: { profile: EInvoiceProfile }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={profile === 'EARSIVFATURA' ? 'neutral' : 'info'}>
      {t(`einvoice.profile.${profile}`)}
    </ToneBadge>
  );
}

export function DirectionLabel({ direction }: { direction: EInvoiceDirection }) {
  const { t } = useTranslation();
  return <>{t(`einvoice.direction.${direction}`)}</>;
}

/** Refreshes e-invoice lists, the summary and the sales and purchase invoices they touch. */
export function useInvalidateEInvoices() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['e-invoices', 'sales-invoices', 'purchase-invoices'].some((path) =>
            key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}

/** Choose the scenario and queue a sales invoice for GİB. */
export function SendEInvoiceDialog({
  open,
  onOpenChange,
  salesInvoiceId,
  number,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salesInvoiceId: string;
  number: string;
  onSent?: (eInvoice: EInvoiceDetailDto) => void;
}) {
  const { t } = useTranslation();
  const send = useEInvoiceSend();
  const invalidate = useInvalidateEInvoices();
  const schema = z.object({ profile: z.string() });
  return (
    <SimpleFormDialog<z.infer<typeof schema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('einvoice.send.title', { number })}
      description={<p className="text-muted-foreground text-sm">{t('einvoice.send.hint')}</p>}
      schema={schema}
      defaultValues={{ profile: AUTO }}
      pending={send.isPending}
      fields={[
        {
          name: 'profile',
          label: t('einvoice.profileLabel'),
          type: 'select',
          required: true,
          wide: true,
          options: [
            { value: AUTO, label: t('einvoice.send.auto') },
            ...Object.values(EInvoiceProfile).map((value) => ({
              value,
              label: t(`einvoice.profile.${value}`),
            })),
          ],
        },
      ]}
      onSubmit={(values) =>
        send.mutate(
          {
            data: {
              salesInvoiceId,
              profile: values.profile === AUTO ? undefined : (values.profile as EInvoiceProfile),
            },
          },
          {
            onSuccess: async (created) => {
              toast.success(t('einvoice.send.done', { number: created.number }));
              onOpenChange(false);
              await invalidate();
              onSent?.(created);
            },
          },
        )
      }
    />
  );
}

/**
 * Accept or reject a ticari fatura: an incoming one for real, or the receiver's answer to an
 * outgoing one (simulation).
 */
export function RespondDialog({
  open,
  onOpenChange,
  eInvoice,
  action,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eInvoice: EInvoiceDetailDto;
  action: 'ACCEPT' | 'REJECT';
}) {
  const { t } = useTranslation();
  const respond = useEInvoiceRespond();
  const simulate = useEInvoiceSimulateResponse();
  const invalidate = useInvalidateEInvoices();
  const incoming = eInvoice.direction === 'INCOMING';
  const mutation = incoming ? respond : simulate;
  const reject = action === 'REJECT';
  const schema = z.object({
    note: reject ? z.string().trim().min(2, 'validation.required').max(300) : z.string(),
  });
  const key = incoming
    ? reject
      ? 'einvoice.respond.incomingReject'
      : 'einvoice.respond.incomingAccept'
    : reject
      ? 'einvoice.respond.outgoingReject'
      : 'einvoice.respond.outgoingAccept';
  return (
    <SimpleFormDialog<z.infer<typeof schema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t(key, { number: eInvoice.number })}
      description={
        <p className="text-muted-foreground text-sm">
          {t(reject ? 'einvoice.respond.rejectHint' : 'einvoice.respond.acceptHint')}
        </p>
      }
      schema={schema}
      defaultValues={{ note: '' }}
      pending={mutation.isPending}
      fields={[
        {
          name: 'note',
          label: reject ? t('einvoice.respond.reason') : t('einvoice.respond.note'),
          type: 'textarea',
          wide: true,
        },
      ]}
      onSubmit={(values) =>
        mutation.mutate(
          { id: eInvoice.id, data: { action, note: values.note.trim() || undefined } },
          {
            onSuccess: async () => {
              toast.success(t(reject ? 'einvoice.respond.rejected' : 'einvoice.respond.accepted'));
              onOpenChange(false);
              await invalidate();
            },
          },
        )
      }
    />
  );
}

/** Simulates a supplier sending us an e-Fatura. */
export function SimulateIncomingDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (eInvoice: EInvoiceDetailDto) => void;
}) {
  const { t } = useTranslation();
  const simulate = useEInvoiceSimulateIncoming();
  const invalidate = useInvalidateEInvoices();
  const { data: suppliers } = usePartnersFindAll(
    { type: 'SUPPLIER', isActive: true, pageSize: 100, sortBy: 'title', sortOrder: 'asc' },
    { query: { enabled: open } },
  );
  const schema = z.object({ partnerId: z.string(), profile: z.string() });
  return (
    <SimpleFormDialog<z.infer<typeof schema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('einvoice.simulate.title')}
      description={<p className="text-muted-foreground text-sm">{t('einvoice.simulate.hint')}</p>}
      schema={schema}
      defaultValues={{ partnerId: '', profile: 'TICARIFATURA' }}
      pending={simulate.isPending}
      fields={[
        {
          name: 'partnerId',
          label: t('einvoice.supplier'),
          type: 'select',
          placeholder: t('einvoice.simulate.randomSupplier'),
          wide: true,
          options: (suppliers?.data ?? []).map((p) => ({
            value: p.id,
            label: `${p.code} · ${p.title}`,
          })),
        },
        {
          name: 'profile',
          label: t('einvoice.profileLabel'),
          type: 'select',
          required: true,
          wide: true,
          options: (['TICARIFATURA', 'TEMELFATURA'] as const).map((value) => ({
            value,
            label: t(`einvoice.profile.${value}`),
          })),
        },
      ]}
      onSubmit={(values) =>
        simulate.mutate(
          {
            data: {
              partnerId: values.partnerId || undefined,
              profile: values.profile as 'TICARIFATURA' | 'TEMELFATURA',
            },
          },
          {
            onSuccess: async (created) => {
              toast.success(
                t('einvoice.simulate.done', {
                  number: created.number,
                  partner: created.partnerTitle,
                }),
              );
              onOpenChange(false);
              await invalidate();
              onCreated?.(created);
            },
          },
        )
      }
    />
  );
}

const ALIAS = /^urn:mail:[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EInvoiceSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { data: settings } = useEInvoiceSettings({ query: { enabled: open } });
  const update = useEInvoiceUpdateSettings();
  const invalidate = useInvalidateEInvoices();
  const schema = z.object({
    senderAlias: z.string().trim().regex(ALIAS, 'partners.errors.eInvoiceAlias'),
    defaultProfile: z.enum(['TICARIFATURA', 'TEMELFATURA']),
    autoSend: z.boolean(),
  });
  if (!settings) return null;
  return (
    <SimpleFormDialog<z.infer<typeof schema>>
      open={open}
      onOpenChange={onOpenChange}
      title={t('einvoice.settings.title')}
      description={<p className="text-muted-foreground text-sm">{t('einvoice.settings.hint')}</p>}
      schema={schema}
      defaultValues={{
        senderAlias: settings.senderAlias,
        defaultProfile: settings.defaultProfile === 'TEMELFATURA' ? 'TEMELFATURA' : 'TICARIFATURA',
        autoSend: settings.autoSend,
      }}
      pending={update.isPending}
      fields={[
        { name: 'senderAlias', label: t('einvoice.settings.senderAlias'), wide: true },
        {
          name: 'defaultProfile',
          label: t('einvoice.settings.defaultProfile'),
          type: 'select',
          required: true,
          wide: true,
          options: (['TICARIFATURA', 'TEMELFATURA'] as const).map((value) => ({
            value,
            label: t(`einvoice.profile.${value}`),
          })),
        },
        { name: 'autoSend', label: t('einvoice.settings.autoSend'), type: 'switch', wide: true },
      ]}
      onSubmit={(values) =>
        update.mutate(
          { data: values },
          {
            onSuccess: async () => {
              toast.success(t('common.saved'));
              onOpenChange(false);
              await invalidate();
            },
          },
        )
      }
    />
  );
}
