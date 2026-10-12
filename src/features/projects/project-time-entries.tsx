import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  timeEntriesFindAll,
  useTimeEntriesFindAll,
} from '@/api/generated/endpoints/projects/projects';
import type { ProjectDetailDto, TimeEntryDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { useFormatHours } from './project-components';

/** Everybody's time for people who see costs, otherwise the user's own entries. */
export function ProjectTimeEntries({ project }: { project: ProjectDetailDto }) {
  const { t } = useTranslation();
  const hours = useFormatHours();
  const table = useTableState({ sort: [{ id: 'workDate', desc: true }] });
  const params = { ...table.params, projectId: project.id };
  const { data, isLoading } = useTimeEntriesFindAll(params, { query: tableQuery });
  const costs = project.canSeeCosts;

  const columns = useMemo<ColumnDef<TimeEntryDto, unknown>[]>(
    () => [
      {
        id: 'workDate',
        header: t('projects.time.date'),
        cell: ({ row }) => formatDate(row.original.workDate),
      },
      {
        id: 'employee',
        header: t('projects.members.employee'),
        enableSorting: false,
        cell: ({ row }) => row.original.employeeName,
      },
      {
        id: 'task',
        header: t('projects.time.task'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.taskNo ? (
            <span>
              <span className="text-muted-foreground mr-1 font-mono text-xs">
                #{row.original.taskNo}
              </span>
              {row.original.taskTitle}
            </span>
          ) : (
            <span className="text-muted-foreground">{t('projects.time.general')}</span>
          ),
      },
      {
        id: 'description',
        header: t('common.description'),
        enableSorting: false,
        cell: ({ row }) => row.original.description,
      },
      {
        id: 'hours',
        header: t('projects.time.hours'),
        cell: ({ row }) => <span className="tabular-nums">{hours(row.original.hours)}</span>,
      },
      ...(costs
        ? [
            {
              id: 'cost',
              header: t('projects.time.cost'),
              enableSorting: false,
              cell: ({ row }) => (
                <span className="tabular-nums">
                  {formatMoney(row.original.costAmount, project.currencyCode)}
                </span>
              ),
            } satisfies ColumnDef<TimeEntryDto, unknown>,
          ]
        : []),
    ],
    [t, hours, costs, project.currencyCode],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      timeEntriesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      `${project.number}-time`,
      [
        { header: t('projects.time.date'), value: (r) => new Date(r.workDate) },
        { header: t('projects.members.employee'), value: (r) => r.employeeName },
        {
          header: t('projects.time.task'),
          value: (r) => (r.taskNo ? `#${r.taskNo} ${r.taskTitle}` : null),
        },
        { header: t('common.description'), value: (r) => r.description },
        { header: t('projects.time.hours'), value: (r) => Number(r.hours) },
        ...(costs
          ? [
              {
                header: t('projects.time.cost'),
                value: (r: TimeEntryDto) => (r.costAmount ? Number(r.costAmount) : null),
              },
            ]
          : []),
      ],
      rows,
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-sm">
        {costs ? t('projects.time.allHint') : t('projects.time.ownHint')}
        {data && ` · ${t('projects.time.total', { hours: hours(data.totalHours) })}`}
      </p>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        searchable={false}
        onExport={handleExport}
      />
    </div>
  );
}
