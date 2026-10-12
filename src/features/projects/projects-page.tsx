import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  projectsFindAll,
  useProjectsFindAll,
  useProjectsSummary,
} from '@/api/generated/endpoints/projects/projects';
import type { ProjectDto, ProjectStatus } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import {
  BudgetBar,
  PROJECT_STATUSES,
  ProgressBar,
  ProjectStatusBadge,
  useFormatHours,
} from './project-components';
import { ProjectFormDialog } from './project-form-dialog';

const OPEN = 'OPEN';
const ALL = 'ALL';

export function ProjectsPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const hours = useFormatHours();
  const table = useTableState({ sort: [{ id: 'dueDate', desc: false }] });
  const [status, setStatus] = useState(OPEN);
  const [onlyMine, setOnlyMine] = useState(false);
  const [creating, setCreating] = useState(false);
  const { data: summary } = useProjectsSummary();
  const seesAll = can('projects:read');

  const params = {
    ...table.params,
    status: status === OPEN || status === ALL ? undefined : (status as ProjectStatus),
    open: status === OPEN ? ('true' as const) : undefined,
    mine: onlyMine ? ('true' as const) : undefined,
  };
  const { data, isLoading } = useProjectsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<ProjectDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'name',
        header: t('projects.name'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.name}</span>
            {row.original.partnerTitle && (
              <span className="text-muted-foreground block text-xs">
                {row.original.partnerTitle}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'manager',
        header: t('projects.manager'),
        enableSorting: false,
        cell: ({ row }) => row.original.managerName,
      },
      {
        id: 'progress',
        header: t('projects.progress'),
        enableSorting: false,
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <ProgressBar value={row.original.progress} />
            <div className="text-muted-foreground text-xs tabular-nums">
              {t('projects.tasksDone', {
                done: row.original.doneTaskCount,
                total: row.original.taskCount,
              })}
            </div>
          </div>
        ),
      },
      {
        id: 'dueDate',
        header: t('projects.dueDate'),
        cell: ({ row }) => (
          <span className={cn(row.original.overdue && 'text-destructive font-medium')}>
            {formatDate(row.original.dueDate)}
          </span>
        ),
      },
      {
        id: 'loggedHours',
        header: t('projects.loggedHours'),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{hours(row.original.loggedHours)}</span>,
      },
      {
        id: 'budget',
        header: t('projects.budgetUsage'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.totalCost === null ? (
            <span className="text-muted-foreground text-xs">—</span>
          ) : (
            <div className="space-y-0.5">
              <BudgetBar usage={row.original.budgetUsage} />
              <div className="text-muted-foreground text-xs tabular-nums">
                {formatMoney(row.original.totalCost, row.original.currencyCode)}
                {row.original.budgetAmount &&
                  ` / ${formatMoney(row.original.budgetAmount, row.original.currencyCode)}`}
              </div>
            </div>
          ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
      },
    ],
    [t, hours],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => projectsFindAll({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      'projects',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('projects.name'), value: (r) => r.name },
        { header: t('projects.customer'), value: (r) => r.partnerTitle },
        { header: t('projects.manager'), value: (r) => r.managerName },
        {
          header: t('projects.startDate'),
          value: (r) => (r.startDate ? new Date(r.startDate) : null),
        },
        { header: t('projects.dueDate'), value: (r) => (r.dueDate ? new Date(r.dueDate) : null) },
        { header: t('projects.progress'), value: (r) => r.progress },
        { header: t('projects.loggedHours'), value: (r) => Number(r.loggedHours) },
        {
          header: t('projects.budget'),
          value: (r) => (r.budgetAmount ? Number(r.budgetAmount) : null),
        },
        {
          header: t('projects.totalCost'),
          value: (r) => (r.totalCost ? Number(r.totalCost) : null),
        },
        { header: t('common.status'), value: (r) => t(`projects.status.${r.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('projects.title')}
        description={t('projects.subtitle')}
        actions={
          <Can permission="projects:create">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('projects.new')}
            </Button>
          </Can>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('projects.summary.active')}
          value={summary?.activeCount}
          hint={summary && t('projects.summary.overdue', { count: summary.overdueCount })}
        />
        <KpiCard
          label={t('projects.summary.overBudget')}
          value={summary?.overBudgetCount}
          tone={summary && summary.overBudgetCount > 0 ? 'negative' : undefined}
        />
        <KpiCard
          label={t('projects.summary.myTasks')}
          value={summary?.myOpenTaskCount}
          hint={summary && t('projects.summary.overdue', { count: summary.myOverdueTaskCount })}
        />
        <KpiCard
          label={t('projects.summary.myHours')}
          value={summary && hours(summary.myHoursThisWeek)}
        />
      </div>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/projects/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={OPEN}>{t('projects.openOnly')}</SelectItem>
                <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
                {PROJECT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`projects.status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {seesAll && (
              <div className="flex items-center gap-2">
                <Switch
                  id="projects-mine"
                  checked={onlyMine}
                  onCheckedChange={(checked) => {
                    setOnlyMine(checked);
                    resetPage();
                  }}
                />
                <Label htmlFor="projects-mine" className="text-sm font-normal">
                  {t('projects.onlyMine')}
                </Label>
              </div>
            )}
          </>
        }
      />
      <ProjectFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(project) => void navigate({ to: '/projects/$id', params: { id: project.id } })}
      />
    </>
  );
}
