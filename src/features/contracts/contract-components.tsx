import { useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useContractsOwners,
  useContractTypesFindAll,
} from '@/api/generated/endpoints/contracts/contracts';
import type {
  ContractBillingCycle,
  ContractDto,
  ContractParty,
  ContractState,
} from '@/api/generated/model';
import i18n from '@/i18n';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';

const STATE_TONES: Record<ContractState, Tone> = {
  DRAFT: 'neutral',
  ACTIVE: 'success',
  EXPIRING: 'warning',
  TERMINATING: 'danger',
  EXPIRED: 'neutral',
  TERMINATED: 'neutral',
};

export const BILLING_CYCLES: ContractBillingCycle[] = [
  'ONE_TIME',
  'MONTHLY',
  'QUARTERLY',
  'YEARLY',
];

/** Last day of a term of `months` months starting on `start` (YYYY-MM-DD), as the API computes it. */
export function suggestEnd(start: string, months: number): string {
  const [year, month, day] = start.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month - 1 + months + 1, 0)).getUTCDate();
  const next = new Date(Date.UTC(year, month - 1 + months, Math.min(day, lastDay)));
  return new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10);
}

export function ContractStateBadge({ state }: { state: ContractState }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATE_TONES[state]}>{t(`contracts.state.${state}`)}</ToneBadge>;
}

/** "₺15.000 / ay"; one-time amounts have no suffix. */
export function formatContractAmount(
  amount: string | null,
  currencyCode: string,
  cycle: ContractBillingCycle,
): string {
  if (amount === null) return '—';
  const money = formatMoney(amount, currencyCode);
  return cycle === 'ONE_TIME' ? money : `${money} / ${i18n.t(`contracts.per.${cycle}`)}`;
}

/** End date plus "12 days left"; open-ended contracts say so. */
export function TermCell({ contract }: { contract: ContractDto }) {
  const { t } = useTranslation();
  const last = contract.terminatedOn ?? contract.endDate;
  const running = contract.status === 'ACTIVE';
  const days = contract.terminatedOn
    ? Math.round(
        (Date.parse(contract.terminatedOn) - Date.parse(new Date().toISOString().slice(0, 10))) /
          86_400_000,
      )
    : contract.daysLeft;
  return (
    <span className="inline-flex flex-col">
      <span className="text-sm">
        {formatDate(contract.startDate)} – {last ? formatDate(last) : t('contracts.openEnded')}
      </span>
      {running && last && days !== null && (
        <span
          className={
            contract.state === 'ACTIVE'
              ? 'text-muted-foreground text-xs'
              : 'text-xs text-amber-600 dark:text-amber-400'
          }
        >
          {days >= 0
            ? t('contracts.daysLeft', { count: days })
            : t('contracts.daysOver', { count: -days })}
          {contract.autoRenew && !contract.terminatedOn && ` · ${t('contracts.autoRenewShort')}`}
        </span>
      )}
    </span>
  );
}

export function useContractTypeOptions(
  party?: ContractParty,
  includeId?: string | null,
): (SelectOption & { party: ContractParty })[] {
  const { data } = useContractTypesFindAll({ query: { staleTime: 60_000 } });
  return (data ?? [])
    .filter((c) => (c.isActive || c.id === includeId) && (!party || c.party === party))
    .map((c) => ({ value: c.id, label: c.name, party: c.party }));
}

export function useOwnerOptions(enabled = true): SelectOption[] {
  const { data } = useContractsOwners({ query: { enabled, staleTime: 60_000 } });
  return (data ?? []).map((o) => ({ value: o.id, label: o.name }));
}

/** Every contract query; a change moves the list, the dashboard and the type counts. */
export function useInvalidateContracts() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['contracts', 'contract-types'].some((path) => key.startsWith(`/api/v1/${path}`))
        );
      },
    });
}

/** Contract list columns; `hideParty` drops the party on partner and employee pages. */
export function useContractColumns(hideParty = false) {
  const { t } = useTranslation();
  return useMemo<ColumnDef<ContractDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('contracts.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'title',
        header: t('contracts.titleLabel'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.title}</span>
            <span className="text-muted-foreground block text-xs">
              {hideParty
                ? row.original.typeName
                : `${row.original.partyName} · ${row.original.typeName}`}
            </span>
          </span>
        ),
      },
      {
        id: 'endDate',
        header: t('contracts.term'),
        cell: ({ row }) => <TermCell contract={row.original} />,
      },
      {
        id: 'amount',
        header: t('contracts.amount'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">
            {formatContractAmount(
              row.original.amount,
              row.original.currencyCode,
              row.original.billingCycle,
            )}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <ContractStateBadge state={row.original.state} />,
      },
      ...(hideParty
        ? []
        : [
            {
              id: 'owner',
              header: t('contracts.owner'),
              enableSorting: false,
              cell: ({ row }: { row: { original: ContractDto } }) => (
                <span className="text-sm">{row.original.ownerName}</span>
              ),
            },
          ]),
    ],
    [t, hideParty],
  );
}
