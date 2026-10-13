import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTicketsMine } from '@/api/generated/endpoints/support/support';
import type { TicketDto } from '@/api/generated/model';
import { Rating } from '@/features/recruitment/recruitment-components';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDateTime, formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { TicketPriorityBadge, TicketStatusBadge } from './support-components';
import { TicketFormDialog } from './ticket-form-dialog';

type View = 'active' | 'closed' | 'all';

/** Self-service: the user's own tickets. */
export function MyTicketsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<View>('active');
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useTicketsMine();

  const all = data ?? [];
  const active = all.filter((r) => r.status !== 'CLOSED');
  const needsMe = all.filter((r) => r.status === 'WAITING' || r.status === 'RESOLVED');
  const rows =
    view === 'active' ? active : view === 'closed' ? all.filter((r) => !active.includes(r)) : all;

  const columns = useMemo<ColumnDef<TicketDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('support.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'subject',
        header: t('support.subject'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.subject}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.categoryName ?? t('support.noCategory')}
            </span>
          </span>
        ),
      },
      {
        id: 'priority',
        header: t('support.priorityLabel'),
        cell: ({ row }) => <TicketPriorityBadge priority={row.original.priority} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => (
          <span className="inline-flex flex-col items-start gap-0.5">
            <TicketStatusBadge status={row.original.status} />
            {row.original.status === 'WAITING' && (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {t('support.my.replyNeeded')}
              </span>
            )}
            {row.original.status === 'RESOLVED' && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400">
                {t('support.my.confirmNeeded')}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'assignee',
        header: t('support.assignee'),
        cell: ({ row }) =>
          row.original.assigneeName ?? (
            <span className="text-muted-foreground">{t('support.unassigned')}</span>
          ),
      },
      {
        id: 'updatedAt',
        header: t('support.lastActivity'),
        cell: ({ row }) => (
          <span className="text-sm" title={formatDateTime(row.original.updatedAt)}>
            {formatRelative(row.original.updatedAt)}
            {row.original.satisfactionRating !== null && (
              <span className="block">
                <Rating value={row.original.satisfactionRating} />
              </span>
            )}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t('support.my.title')}
        description={t('support.my.subtitle')}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> {t('support.new')}
          </Button>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <KpiCard label={t('support.my.active')} value={data && active.length} />
        <KpiCard
          label={t('support.my.needsMe')}
          value={data && needsMe.length}
          tone={needsMe.length ? 'negative' : undefined}
          hint={t('support.my.needsMeHint')}
        />
        <KpiCard label={t('support.my.total')} value={data && all.length} />
      </div>
      <Tabs value={view} onValueChange={(value) => setView(value as View)} className="mb-3">
        <TabsList>
          <TabsTrigger value="active">
            {t('support.my.activeTab')} ({active.length})
          </TabsTrigger>
          <TabsTrigger value="closed">
            {t('support.my.closedTab')} ({all.length - active.length})
          </TabsTrigger>
          <TabsTrigger value="all">{t('support.my.allTab')}</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchable={false}
        onRowClick={(row) => void navigate({ to: '/support/tickets/$id', params: { id: row.id } })}
      />
      <TicketFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(ticket) =>
          void navigate({ to: '/support/tickets/$id', params: { id: ticket.id } })
        }
      />
    </>
  );
}
