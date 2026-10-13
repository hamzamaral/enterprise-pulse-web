import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  useTicketCategoriesFindAll,
  useTicketsAgents,
} from '@/api/generated/endpoints/support/support';
import type { SlaState, TicketDto, TicketPriority, TicketStatus } from '@/api/generated/model';
import { formatDecimal } from '@/features/training/training-components';
import i18n from '@/i18n';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatRelative } from '@/shared/lib/format';

const STATUS_TONES: Record<TicketStatus, Tone> = {
  OPEN: 'warning',
  IN_PROGRESS: 'info',
  WAITING: 'neutral',
  RESOLVED: 'success',
  CLOSED: 'neutral',
};

const PRIORITY_TONES: Record<TicketPriority, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  URGENT: 'danger',
};

const SLA_TONES: Record<SlaState, Tone> = {
  ON_TRACK: 'info',
  AT_RISK: 'warning',
  BREACHED: 'danger',
  MET: 'success',
  PAUSED: 'neutral',
};

export const PRIORITIES: TicketPriority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];

export const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING'];

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`support.status.${status}`)}</ToneBadge>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  const { t } = useTranslation();
  return <ToneBadge tone={PRIORITY_TONES[priority]}>{t(`support.priority.${priority}`)}</ToneBadge>;
}

export function SlaBadge({ state }: { state: SlaState }) {
  const { t } = useTranslation();
  return <ToneBadge tone={SLA_TONES[state]}>{t(`support.sla.${state}`)}</ToneBadge>;
}

/**
 * The SLA target that matters now: the first response until someone answered, then the
 * resolution.
 */
export function currentTarget(ticket: TicketDto) {
  const responding =
    !ticket.firstRespondedAt &&
    ACTIVE_STATUSES.includes(ticket.status) &&
    ticket.status !== 'WAITING';
  return responding
    ? { kind: 'response' as const, state: ticket.responseSla, dueAt: ticket.firstResponseDueAt }
    : { kind: 'resolution' as const, state: ticket.resolutionSla, dueAt: ticket.resolutionDueAt };
}

/** Badge plus "response · in 3 hours" under it. */
export function SlaCell({ ticket }: { ticket: TicketDto }) {
  const { t } = useTranslation();
  const target = currentTarget(ticket);
  const running = target.state === 'ON_TRACK' || target.state === 'AT_RISK';
  const late = target.state === 'BREACHED' && ACTIVE_STATUSES.includes(ticket.status);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <SlaBadge state={target.state} />
      <span className="text-muted-foreground text-xs">
        {t(`support.sla.${target.kind}`)}
        {(running || late) && ` · ${formatRelative(target.dueAt)}`}
      </span>
    </span>
  );
}

/** Hours with one decimal in the UI language, e.g. "1,5 sa". */
export function formatHours(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return i18n.t('support.hoursValue', { value: formatDecimal(value) });
}

export function useAgentOptions(enabled = true): SelectOption[] {
  const { data } = useTicketsAgents({ query: { enabled, staleTime: 60_000 } });
  return (data ?? []).map((a) => ({ value: a.id, label: a.name }));
}

/** Active categories for new tickets; pass `includeId` to keep a deactivated current value. */
export function useCategoryOptions(includeId?: string | null): SelectOption[] {
  const { data } = useTicketCategoriesFindAll({ query: { staleTime: 60_000 } });
  return (data ?? [])
    .filter((c) => c.isActive || c.id === includeId)
    .map((c) => ({ value: c.id, label: c.name }));
}

/** Every support query; a ticket change moves the queue, the summary and the categories. */
export function useInvalidateSupport() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['tickets', 'ticket-categories', 'ticket-sla-policies'].some((path) =>
            key.startsWith(`/api/v1/${path}`),
          )
        );
      },
    });
}
