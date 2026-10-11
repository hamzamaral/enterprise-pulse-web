import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCheck, Loader2, Megaphone } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useNotificationsFindMine,
  useNotificationsMarkAllRead,
  useNotificationsSend,
} from '@/api/generated/endpoints/notifications/notifications';
import { Can } from '@/features/auth/can';
import { PageHeader } from '@/shared/components/page-header';
import { tableQuery } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Switch } from '@/shared/ui/switch';
import { Textarea } from '@/shared/ui/textarea';
import {
  NotificationItem,
  useInvalidateNotifications,
  useOpenNotification,
} from './notification-bell';

const sendSchema = z.object({
  title: v.requiredString(),
  body: v.requiredString(),
  sendEmail: z.boolean(),
});

function SendAnnouncementDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const send = useNotificationsSend();
  const form = useForm({
    resolver: zodResolver(sendSchema),
    defaultValues: { title: '', body: '', sendEmail: false },
  });

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Megaphone /> {t('notifications.send')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('notifications.sendTitle')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={form.handleSubmit((values) =>
                send.mutate(
                  { data: values },
                  {
                    onSuccess: () => {
                      toast.success(t('notifications.sent'));
                      form.reset();
                      setOpen(false);
                    },
                  },
                ),
              )}
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('notifications.titleField')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="body"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('notifications.body')}</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sendEmail"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">{t('notifications.sendEmail')}</FormLabel>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={send.isPending}>
                  {send.isPending && <Loader2 className="animate-spin" />}
                  {t('notifications.send')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const { data } = useNotificationsFindMine(
    { page, pageSize: 20, unreadOnly: unreadOnly ? 'true' : undefined },
    { query: tableQuery },
  );
  const markAll = useNotificationsMarkAllRead();
  const invalidate = useInvalidateNotifications();
  const open = useOpenNotification();

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        actions={
          <>
            <Can permission="notifications:send">
              <SendAnnouncementDialog />
            </Can>
            <Button
              variant="outline"
              onClick={() => markAll.mutate(undefined, { onSuccess: () => void invalidate() })}
            >
              <CheckCheck /> {t('notifications.markAllRead')}
            </Button>
          </>
        }
      />
      <label className="mb-4 flex items-center gap-2 text-sm">
        <Checkbox
          checked={unreadOnly}
          onCheckedChange={(checked) => {
            setUnreadOnly(checked === true);
            setPage(1);
          }}
        />
        {t('notifications.unreadOnly')}
      </label>
      <Card>
        <CardContent className="p-2">
          {data?.data.length ? (
            data.data.map((n) => <NotificationItem key={n.id} notification={n} onOpen={open} />)
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t('notifications.empty')}
            </p>
          )}
        </CardContent>
      </Card>
      {data && data.meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            ‹
          </Button>
          {t('common.pageOf', { page, total: data.meta.totalPages })}
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.meta.totalPages}
            onClick={() => setPage(page + 1)}
          >
            ›
          </Button>
        </div>
      )}
    </>
  );
}
