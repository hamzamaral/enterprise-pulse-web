import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useRouter } from '@tanstack/react-router';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { useAuthLogin } from '@/api/generated/endpoints/auth/auth';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { useAuthStore } from './auth.store';
import { AuthLayout } from './auth-layout';

const schema = z.object({
  email: v.email(),
  password: v.requiredString(),
  otp: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@enterprisepulse.dev', password: 'Admin123!' },
  { label: 'Müdür', email: 'manager@enterprisepulse.dev', password: 'Manager123!' },
  { label: 'Personel', email: 'employee@enterprisepulse.dev', password: 'Employee123!' },
];

export function LoginPage({ redirectTo }: { redirectTo?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const [needsOtp, setNeedsOtp] = useState(false);
  const login = useAuthLogin();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', otp: '' },
  });

  const onSubmit = (values: FormValues) => {
    login.mutate(
      { data: { email: values.email, password: values.password, otp: values.otp || undefined } },
      {
        onSuccess: async (result) => {
          if (result.requiresTwoFactor) {
            setNeedsOtp(true);
            return;
          }
          setAccessToken(result.accessToken ?? null);
          queryClient.clear();
          if (redirectTo?.startsWith('/') && !redirectTo.startsWith('//'))
            router.history.push(redirectTo);
          else await navigate({ to: '/' });
        },
      },
    );
  };

  return (
    <AuthLayout title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.email')}</FormLabel>
                <FormControl>
                  <Input type="email" autoComplete="username" autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('auth.password')}</FormLabel>
                  <Link to="/forgot-password" className="text-primary text-xs hover:underline">
                    {t('auth.forgotPassword')}
                  </Link>
                </div>
                <FormControl>
                  <Input type="password" autoComplete="current-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {needsOtp && (
            <FormField
              control={form.control}
              name="otp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('auth.otp')}</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      autoComplete="one-time-code"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{t('auth.otpHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending && <Loader2 className="animate-spin" />}
            {t('auth.login')}
          </Button>
        </form>
      </Form>

      <div className="rounded-lg border border-dashed p-3">
        <p className="text-muted-foreground mb-2 text-xs font-medium">{t('auth.demoAccounts')}</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((account) => (
            <Button
              key={account.email}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                form.setValue('email', account.email);
                form.setValue('password', account.password);
              }}
            >
              {account.label}
            </Button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
