import { Link } from '@tanstack/react-router';
import { Bell, ClipboardCheck, MapPin, Users, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuditFindAll } from '@/api/generated/endpoints/audit/audit';
import { useNotificationsUnreadCount } from '@/api/generated/endpoints/notifications/notifications';
import { useUsersFindAll } from '@/api/generated/endpoints/users/users';
import {
  useWorkflowInstancesFindAll,
  useWorkflowInstancesInbox,
} from '@/api/generated/endpoints/workflow/workflow';
import { NAVIGATION } from '@/app/layout/navigation';
import { useMe, usePermission } from '@/features/auth/use-session';
import { WorkflowStatusBadge } from '@/features/workflow/workflow-components';
import { formatRelative } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';

function StatCard({
  label,
  value,
  icon: Icon,
  to,
}: {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  to?: '/users' | '/branches' | '/workflow/inbox' | '/notifications';
}) {
  const content = (
    <Card className="hover:border-primary/40 transition-colors">
      <CardContent className="flex items-center gap-4 pt-6">
        <div className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
        <div>
          <div className="text-muted-foreground text-sm">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">
            {value === undefined ? <Skeleton className="h-7 w-10" /> : value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const can = usePermission();

  const users = useUsersFindAll(
    { pageSize: 1, isActive: 'true' },
    { query: { enabled: can('users:read') } },
  );
  const inbox = useWorkflowInstancesInbox({ pageSize: 1 });
  const unread = useNotificationsUnreadCount();
  const activity = useAuditFindAll({ pageSize: 6 }, { query: { enabled: can('audit:read') } });
  const myRequests = useWorkflowInstancesFindAll(
    { pageSize: 5, mine: 'true' },
    { query: { enabled: can('workflow:read') } },
  );

  const company = me?.companies.find((c) => c.id === me.activeCompanyId);
  const roadmap = NAVIGATION.flatMap((g) => g.items).filter((i) => i.comingSoon);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('dashboard.welcome', { name: me?.user.firstName })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {company?.name} · {t('dashboard.subtitle')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {can('users:read') && (
          <StatCard
            label={t('dashboard.users')}
            value={users.data?.meta.total}
            icon={Users}
            to="/users"
          />
        )}
        <StatCard
          label={t('dashboard.branches')}
          value={company?.branches.length}
          icon={MapPin}
          to="/branches"
        />
        <StatCard
          label={t('dashboard.pendingApprovals')}
          value={inbox.data?.meta.total}
          icon={ClipboardCheck}
          to="/workflow/inbox"
        />
        <StatCard
          label={t('dashboard.unread')}
          value={unread.data?.count}
          icon={Bell}
          to="/notifications"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {can('workflow:read') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.myRequests')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {myRequests.data?.data.length ? (
                myRequests.data.data.map((instance) => (
                  <Link
                    key={instance.id}
                    to="/workflow/instances/$id"
                    params={{ id: instance.id }}
                    className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md px-2 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{instance.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatRelative(instance.startedAt)}
                      </div>
                    </div>
                    <WorkflowStatusBadge status={instance.status} />
                  </Link>
                ))
              ) : (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  {t('common.noResults')}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {can('audit:read') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('dashboard.recentActivity')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {activity.data?.data.map((log) => (
                  <li key={log.id} className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium">{log.userEmail ?? 'system'}</span>{' '}
                      <span className="text-muted-foreground">
                        {t(`audit.actions.${log.action}` as never, { defaultValue: log.action })} ·{' '}
                        {log.entityType}
                      </span>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {formatRelative(log.createdAt)}
                    </span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        )}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('dashboard.roadmap')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {roadmap.map((item) => (
              <div key={item.labelKey} className="flex items-center gap-3 rounded-lg border p-3">
                <item.icon className="text-muted-foreground size-5" />
                <span className="text-sm font-medium">{t(item.labelKey as never)}</span>
                <Badge variant="outline" className="ml-auto">
                  {t('nav.comingSoon')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
