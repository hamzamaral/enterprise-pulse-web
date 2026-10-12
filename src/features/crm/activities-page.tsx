import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { crmActivitiesFindAll, useCrmActivitiesFindAll } from '@/api/generated/endpoints/crm/crm';
import { CrmActivityType, type ActivityDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { ActivityFormDialog } from './activity-form-dialog';
import { useActivityActions } from './activity-timeline';
import { ACTIVITY_ICONS, DueText } from './crm-components';

const ALL = 'ALL';
const STATES = ['open', 'overdue', 'done'] as const;
type State = (typeof STATES)[number];

function RelatedLink({ activity }: { activity: ActivityDto }) {
  const can = usePermission();
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  if (activity.opportunityId) {
    return (
      <Link
        to="/crm/opportunities/$id"
        params={{ id: activity.opportunityId }}
        onClick={stop}
        className="text-primary hover:underline"
      >
        {activity.opportunityTitle}
      </Link>
    );
  }
  if (activity.leadId) {
    return (
      <Link
        to="/crm/leads/$id"
        params={{ id: activity.leadId }}
        onClick={stop}
        className="text-primary hover:underline"
      >
        {activity.leadCompanyName}
      </Link>
    );
  }
  if (activity.partnerId) {
    return can('partners:read') ? (
      <Link
        to="/partners/$id"
        params={{ id: activity.partnerId }}
        onClick={stop}
        className="text-primary hover:underline"
      >
        {activity.partnerTitle}
      </Link>
    ) : (
      <span>{activity.partnerTitle}</span>
    );
  }
  return null;
}

export function ActivitiesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'dueAt', desc: false }] });
  const [state, setState] = useState<State | typeof ALL>('open');
  const [type, setType] = useState(ALL);
  const [mine, setMine] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ActivityDto | null>(null);
  const actions = useActivityActions();

  const params = {
    ...table.params,
    state: state === ALL ? undefined : state,
    type: type === ALL ? undefined : (type as CrmActivityType),
    mine: mine ? ('true' as const) : undefined,
  };
  const { data, isLoading } = useCrmActivitiesFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<ActivityDto, unknown>[]>(
    () => [
      {
        id: 'subject',
        header: t('crm.activities.subject'),
        cell: ({ row }) => {
          const activity = row.original;
          const Icon = ACTIVITY_ICONS[activity.type];
          return (
            <div className="flex min-w-0 items-start gap-2">
              <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <div
                  className={cn(
                    'font-medium',
                    activity.completedAt && 'text-muted-foreground line-through',
                  )}
                >
                  {activity.subject}
                </div>
                <div className="text-muted-foreground text-xs">
                  {t(`crm.activities.types.${activity.type}`)}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'related',
        header: t('crm.activities.related'),
        enableSorting: false,
        cell: ({ row }) => <RelatedLink activity={row.original} />,
      },
      {
        id: 'owner',
        header: t('crm.activities.assignee'),
        enableSorting: false,
        cell: ({ row }) => row.original.ownerName,
      },
      {
        id: 'dueAt',
        header: t('crm.activities.dueAt'),
        cell: ({ row }) => <DueText value={row.original.dueAt} overdue={row.original.overdue} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.completedAt ? (
            <ToneBadge tone="success">{t('crm.activities.states.done')}</ToneBadge>
          ) : row.original.overdue ? (
            <ToneBadge tone="danger">{t('crm.activities.states.overdue')}</ToneBadge>
          ) : (
            <ToneBadge tone="info">{t('crm.activities.states.open')}</ToneBadge>
          ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          can('crm:update') && row.original.type !== 'NOTE' ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={actions.pending}
              onClick={(e) => {
                e.stopPropagation();
                actions.toggle(row.original);
              }}
            >
              {row.original.completedAt ? <RotateCcw /> : <Check />}
              {row.original.completedAt ? t('crm.activities.reopen') : t('crm.activities.complete')}
            </Button>
          ) : null,
      },
    ],
    [t, can, actions],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      crmActivitiesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'crm-activities',
      [
        { header: t('crm.activities.type'), value: (a) => t(`crm.activities.types.${a.type}`) },
        { header: t('crm.activities.subject'), value: (a) => a.subject },
        {
          header: t('crm.activities.related'),
          value: (a) => a.opportunityTitle ?? a.leadCompanyName ?? a.partnerTitle,
        },
        { header: t('crm.activities.assignee'), value: (a) => a.ownerName },
        { header: t('crm.activities.dueAt'), value: (a) => (a.dueAt ? new Date(a.dueAt) : null) },
        {
          header: t('common.status'),
          value: (a) =>
            t(`crm.activities.states.${a.completedAt ? 'done' : a.overdue ? 'overdue' : 'open'}`),
        },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('crm.activities.title')}
        description={t('crm.activities.subtitle')}
        actions={
          <Can permission="crm:create">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('crm.activities.new')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={can('crm:update') ? (row) => setEditing(row) : undefined}
        toolbar={
          <>
            <Select
              value={state}
              onValueChange={(value) => {
                setState(value as State | typeof ALL);
                resetPage();
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('crm.activities.allStates')}</SelectItem>
                {STATES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`crm.activities.states.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={type}
              onValueChange={(value) => {
                setType(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('crm.activities.allTypes')}</SelectItem>
                {Object.values(CrmActivityType).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`crm.activities.types.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="activities-mine"
                checked={mine}
                onCheckedChange={(value) => {
                  setMine(value);
                  resetPage();
                }}
              />
              <Label htmlFor="activities-mine">{t('crm.activities.assignedToMe')}</Label>
            </div>
          </>
        }
      />
      <ActivityFormDialog open={creating} onOpenChange={setCreating} />
      {editing && (
        <ActivityFormDialog
          open={!!editing}
          onOpenChange={(value) => !value && setEditing(null)}
          activity={editing}
        />
      )}
    </>
  );
}
