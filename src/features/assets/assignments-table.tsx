import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { CheckCircle2, Clock } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { AssignmentDto } from '@/api/generated/model';
import { DataTable, type PageMeta } from '@/shared/components/data-table/data-table';
import type { ExportFormat } from '@/shared/components/data-table/export-table';
import type { TableState } from '@/shared/components/data-table/use-table-state';
import { formatDate } from '@/shared/lib/format';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { Assignee, AssignmentStatusBadge } from './asset-components';

export function AcknowledgedIcon({ assignment }: { assignment: AssignmentDto }) {
  const { t } = useTranslation();
  if (assignment.assigneeType !== 'EMPLOYEE') return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {assignment.acknowledgedAt ? (
          <CheckCircle2 className="size-4 text-emerald-600" />
        ) : (
          <Clock className="size-4 text-amber-600" />
        )}
      </TooltipTrigger>
      <TooltipContent>
        {assignment.acknowledgedAt
          ? t('assets.acknowledgedAt', { date: formatDate(assignment.acknowledgedAt) })
          : t('assets.awaitingAcknowledgement')}
      </TooltipContent>
    </Tooltip>
  );
}

interface AssignmentsTableProps {
  data: AssignmentDto[] | undefined;
  meta?: PageMeta;
  isLoading: boolean;
  state?: TableState;
  hideAsset?: boolean;
  hideAssignee?: boolean;
  searchable?: boolean;
  toolbar?: ReactNode;
  onExport?: (format: ExportFormat) => Promise<void>;
}

export function AssignmentsTable({
  data,
  meta,
  isLoading,
  state,
  hideAsset,
  hideAssignee,
  searchable = false,
  toolbar,
  onExport,
}: AssignmentsTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<AssignmentDto, unknown>[]>(
    () =>
      (
        [
          {
            id: 'number',
            header: t('assets.assignmentNo'),
            cell: ({ row }) => (
              <span className="flex items-center gap-2">
                <code className="text-xs">{row.original.number}</code>
                <AcknowledgedIcon assignment={row.original} />
              </span>
            ),
          },
          !hideAsset && {
            id: 'asset',
            header: t('assets.asset'),
            enableSorting: false,
            cell: ({ row }) => (
              <div>
                <div className="font-medium">{row.original.assetName}</div>
                <code className="text-muted-foreground text-xs">{row.original.assetTag}</code>
              </div>
            ),
          },
          !hideAssignee && {
            id: 'assignee',
            header: t('assets.assignee'),
            enableSorting: false,
            cell: ({ row }) => (
              <Assignee type={row.original.assigneeType} name={row.original.assigneeName} />
            ),
          },
          {
            id: 'assignedAt',
            header: t('assets.assignedAt'),
            cell: ({ row }) => formatDate(row.original.assignedAt),
          },
          {
            id: 'returnedAt',
            header: t('assets.returnedAt'),
            enableSorting: false,
            cell: ({ row }) =>
              row.original.returnedAt ? (
                <div>
                  <div>{formatDate(row.original.returnedAt)}</div>
                  {row.original.returnNotes && (
                    <div className="text-muted-foreground max-w-56 truncate text-xs">
                      {row.original.returnNotes}
                    </div>
                  )}
                </div>
              ) : (
                '—'
              ),
          },
          {
            id: 'status',
            header: t('common.status'),
            enableSorting: false,
            cell: ({ row }) => <AssignmentStatusBadge status={row.original.status} />,
          },
        ] satisfies (ColumnDef<AssignmentDto, unknown> | false)[]
      ).filter((column) => column !== false),
    [t, hideAsset, hideAssignee],
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      meta={meta}
      isLoading={isLoading}
      state={state}
      searchable={searchable}
      toolbar={toolbar}
      onExport={onExport}
      onRowClick={(row) => void navigate({ to: '/assets/assignments/$id', params: { id: row.id } })}
    />
  );
}
