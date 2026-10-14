import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getNotificationsFindMineQueryKey,
  getNotificationsUnreadCountQueryKey,
  useNotificationsFindMine,
  useNotificationsMarkAllRead,
  useNotificationsMarkRead,
  useNotificationsUnreadCount,
} from '@/api/generated/endpoints/notifications/notifications';
import type { NotificationDto } from '@/api/generated/model';
import { formatRelative } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

export function useInvalidateNotifications() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getNotificationsUnreadCountQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getNotificationsFindMineQueryKey() }),
    ]);
}

export function NotificationItem({
  notification,
  onOpen,
}: {
  notification: NotificationDto;
  onOpen: (n: NotificationDto) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={cn(
        'hover:bg-muted/60 flex w-full gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
        !notification.readAt && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'mt-1.5 size-2 shrink-0 rounded-full',
          notification.readAt ? 'bg-transparent' : 'bg-primary',
        )}
      />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block truncate text-sm font-medium">{notification.title}</span>
        <span className="text-muted-foreground line-clamp-2 block text-xs">
          {notification.body}
        </span>
        <span className="text-muted-foreground block text-[11px]">
          {formatRelative(notification.createdAt)}
        </span>
      </span>
    </button>
  );
}

export function useOpenNotification() {
  const router = useRouter();
  const markRead = useNotificationsMarkRead();
  const invalidate = useInvalidateNotifications();
  return (notification: NotificationDto) => {
    if (!notification.readAt) {
      markRead.mutate({ id: notification.id }, { onSuccess: () => void invalidate() });
    }
    // Links come from the server, so they may carry a query string the typed router can't model.
    if (notification.link) router.history.push(notification.link);
  };
}

export function NotificationBell() {
  const { t } = useTranslation();
  const { data: unread } = useNotificationsUnreadCount({ query: { refetchInterval: 60_000 } });
  const { data: list } = useNotificationsFindMine({ page: 1, pageSize: 8 });
  const markAll = useNotificationsMarkAllRead();
  const invalidate = useInvalidateNotifications();
  const open = useOpenNotification();
  const count = unread?.count ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={t('notifications.title')}
        >
          <Bell />
          {count > 0 && (
            <span className="bg-destructive absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {count > 99 ? '99+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-96 flex-col p-0"
      >
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <span className="font-medium">{t('notifications.title')}</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!count}
            onClick={() => markAll.mutate(undefined, { onSuccess: () => void invalidate() })}
          >
            <CheckCheck /> {t('notifications.markAllRead')}
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {list?.data.length ? (
            list.data.map((n) => <NotificationItem key={n.id} notification={n} onOpen={open} />)
          ) : (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t('notifications.empty')}
            </p>
          )}
        </div>
        <div className="shrink-0 border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications">{t('notifications.viewAll')}</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
