import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { WorkflowInstanceDto, WorkflowStatus } from '@/api/generated/model';
import { DataTable, type PageMeta } from '@/shared/components/data-table/data-table';
import type { TableState } from '@/shared/components/data-table/use-table-state';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDateTime } from '@/shared/lib/format';

const STATUS_TONES: Record<WorkflowStatus, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`workflow.status.${status}`)}</ToneBadge>;
}

export function InstancesTable({
  data,
  meta,
  isLoading,
  state,
  toolbar,
}: {
  data?: WorkflowInstanceDto[];
  meta?: PageMeta;
  isLoading: boolean;
  state: TableState;
  toolbar?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<WorkflowInstanceDto, unknown>[]>(
    () => [
      {
        id: 'title',
        header: t('workflow.title'),
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title}</div>
            <div className="text-muted-foreground text-xs">
              {row.original.entityType} · {row.original.entityId}
            </div>
          </div>
        ),
      },
      {
        id: 'definition',
        header: t('workflow.definition'),
        enableSorting: false,
        cell: ({ row }) => row.original.definitionName,
      },
      {
        id: 'step',
        header: t('workflow.currentStep'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === 'PENDING'
            ? `${row.original.currentStepName ?? '—'} (${row.original.currentStepOrder}/${row.original.totalSteps})`
            : '—',
      },
      {
        id: 'requester',
        header: t('workflow.requester'),
        enableSorting: false,
        cell: ({ row }) => row.original.startedByName,
      },
      {
        id: 'startedAt',
        header: t('workflow.startedAt'),
        enableSorting: false,
        cell: ({ row }) => formatDateTime(row.original.startedAt),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <WorkflowStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      isLoading={isLoading}
      state={state}
      toolbar={toolbar}
      onRowClick={(row) => void navigate({ to: '/workflow/instances/$id', params: { id: row.id } })}
    />
  );
}
