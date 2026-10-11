import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { toast } from 'sonner';
import {
  getNotificationsFindMineQueryKey,
  getNotificationsUnreadCountQueryKey,
} from '@/api/generated/endpoints/notifications/notifications';
import type { NotificationDto } from '@/api/generated/model';
import { useAuthStore } from '@/features/auth/auth.store';

/** Live notifications over Socket.IO; reconnects whenever the access token rotates. */
export function useNotificationSocket() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;
    const socket = io(`${import.meta.env.VITE_WS_URL ?? ''}/ws`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    socket.on('notification', (notification: NotificationDto) => {
      toast.info(notification.title, { description: notification.body });
      void queryClient.invalidateQueries({ queryKey: getNotificationsUnreadCountQueryKey() });
      void queryClient.invalidateQueries({ queryKey: getNotificationsFindMineQueryKey() });
    });

    return () => {
      socket.disconnect();
    };
  }, [accessToken, queryClient]);
}
