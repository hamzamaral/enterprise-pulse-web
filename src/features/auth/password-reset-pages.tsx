import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { Loader2, MailCheck } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuthForgotPassword, useAuthResetPassword } from '@/api/generated/endpoints/auth/auth';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { AuthLayout } from './auth-layout';

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const forgot = useAuthForgotPassword();
  const form = useForm({
    resolver: zodResolver(z.object({ email: v.email() })),
    defaultValues: { email: '' },
  });

  return (
    <AuthLayout title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      {sent ? (
        <div className="flex items-start gap-3 rounded-lg border bg-emerald-500/10 p-4 text-sm">
          <MailCheck className="size-5 text-emerald-600" />
          {t('auth.linkSent')}
        </div>
      ) : (
        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit((values) =>
              forgot.mutate({ data: values }, { onSuccess: () => setSent(true) }),
            )}
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={forgot.isPending}>
              {forgot.isPending && <Loader2 className="animate-spin" />}
              {t('auth.sendLink')}
            </Button>
          </form>
        </Form>
      )}
      <Link to="/login" className="text-primary block text-center text-sm hover:underline">
        {t('auth.backToLogin')}
      </Link>
    </AuthLayout>
  );
}

const resetSchema = z
  .object({ password: v.password(), confirm: z.string() })
  .refine((d) => d.password === d.confirm, {
    message: 'validation.passwordsMismatch',
    path: ['confirm'],
  });

export function ResetPasswordPage({ token }: { token: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useAuthResetPassword();
  const form = useForm({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: '', confirm: '' },
  });

  return (
    <AuthLayout title={t('auth.resetTitle')}>
      <Form {...form}>
        <form
          className="space-y-4"
          noValidate
          onSubmit={form.handleSubmit((values) =>
            reset.mutate(
              { data: { token, password: values.password } },
              {
                onSuccess: async () => {
                  toast.success(t('auth.resetDone'));
                  await navigate({ to: '/login' });
                },
              },
            ),
          )}
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.newPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.confirmPassword')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={reset.isPending}>
            {reset.isPending && <Loader2 className="animate-spin" />}
            {t('common.save')}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
}
