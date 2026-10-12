import { Check, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getCrmActivitiesFindAllQueryKey,
  getCrmSummaryQueryKey,
  useCrmActivitiesComplete,
  useCrmActivitiesFindAll,
  useCrmActivitiesRemove,
  useCrmActivitiesReopen,
} from '@/api/generated/endpoints/crm/crm';
import type { ActivityDto } from '@/api/generated/model';
import { useMe, usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { formatDateTime } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { ActivityFormDialog, type ActivityLink } from './activity-form-dialog';
import { ACTIVITY_ICONS, DueText } from './crm-components';

/** Complete / reopen / delete with the list and KPI caches refreshed. */
export function useActivityActions() {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const complete = useCrmActivitiesComplete();
  const reopen = useCrmActivitiesReopen();
  const remove = useCrmActivitiesRemove();
  const refresh = () => invalidate(getCrmActivitiesFindAllQueryKey(), getCrmSummaryQueryKey());
  return {
    pending: complete.isPending || reopen.isPending || remove.isPending,
    toggle: (activity: ActivityDto) =>
      activity.completedAt
        ? reopen.mutate(
            { id: activity.id },
            {
              onSuccess: async () => {
                toast.success(t('crm.activities.reopened'));
                await refresh();
              },
            },
          )
        : complete.mutate(
            { id: activity.id },
            {
              onSuccess: async () => {
                toast.success(t('crm.activities.completed'));
                await refresh();
              },
            },
          ),
    remove: (activity: ActivityDto) =>
      remove.mutate(
        { id: activity.id },
        {
          onSuccess: async () => {
            toast.success(t('crm.activities.deleted'));
            await refresh();
          },
        },
      ),
  };
}

/** Activities of a lead, opportunity or customer, newest first, with inline actions. */
export function ActivityTimeline({ link }: { link: ActivityLink }) {
  const { t } = useTranslation();
  const can = usePermission();
  const { data: me } = useMe();
  const [editing, setEditing] = useState<ActivityDto | null>(null);
  const [adding, setAdding] = useState(false);
  const actions = useActivityActions();
  const { data, isLoading } = useCrmActivitiesFindAll({
    ...link,
    pageSize: 50,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const activities = data?.data ?? [];
  const open = activities.filter((a) => !a.completedAt);
  const done = activities.filter((a) => a.completedAt);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('crm.activities.title')}</CardTitle>
        {can('crm:create') && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> {t('crm.activities.add')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : activities.length ? (
          <ol className="space-y-1">
            {[...open, ...done].map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type];
              const deletable = can('crm:delete') || activity.createdById === me?.user.id;
              return (
                <li
                  key={activity.id}
                  className="group hover:bg-muted/50 flex items-start gap-3 rounded-md px-2 py-2"
                >
                  <div
                    className={cn(
                      'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
                      activity.completedAt
                        ? 'bg-muted text-muted-foreground'
                        : activity.overdue
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        activity.completedAt && 'text-muted-foreground line-through',
                      )}
                    >
                      {activity.subject}
                    </div>
                    {activity.description && (
                      <p className="text-muted-foreground text-sm whitespace-pre-line">
                        {activity.description}
                      </p>
                    )}
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span>{t(`crm.activities.types.${activity.type}`)}</span>
                      <span>{activity.ownerName}</span>
                      {activity.completedAt ? (
                        <span>
                          {t('crm.activities.doneAt', {
                            date: formatDateTime(activity.completedAt),
                          })}
                        </span>
                      ) : (
                        <DueText value={activity.dueAt} overdue={activity.overdue} />
                      )}
                    </div>
                  </div>
                  {can('crm:update') && (
                    <div className="flex shrink-0 gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                      {activity.type !== 'NOTE' && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          disabled={actions.pending}
                          title={
                            activity.completedAt
                              ? t('crm.activities.reopen')
                              : t('crm.activities.complete')
                          }
                          onClick={() => actions.toggle(activity)}
                        >
                          {activity.completedAt ? <RotateCcw /> : <Check />}
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        title={t('common.edit')}
                        onClick={() => setEditing(activity)}
                      >
                        <Pencil />
                      </Button>
                      {deletable && (
                        <ConfirmDialog
                          trigger={
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive size-8"
                              title={t('common.delete')}
                            >
                              <Trash2 />
                            </Button>
                          }
                          onConfirm={() => actions.remove(activity)}
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t('crm.activities.empty')}
          </p>
        )}
      </CardContent>
      <ActivityFormDialog open={adding} onOpenChange={setAdding} link={link} />
      {editing && (
        <ActivityFormDialog
          open={!!editing}
          onOpenChange={(value) => !value && setEditing(null)}
          activity={editing}
        />
      )}
    </Card>
  );
}
