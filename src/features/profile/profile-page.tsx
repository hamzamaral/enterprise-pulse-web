import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getAuthMeQueryKey,
  useAuthChangePassword,
  useAuthDisableTwoFactor,
  useAuthEnableTwoFactor,
  useAuthSetupTwoFactor,
} from '@/api/generated/endpoints/auth/auth';
import type { TwoFactorSetupResponseDto } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { initials } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';

const passwordSchema = z
  .object({
    currentPassword: v.requiredString(),
    newPassword: v.password(),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'validation.passwordsMismatch',
  });

function ChangePasswordCard() {
  const { t } = useTranslation();
  const change = useAuthChangePassword();
  const form = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const fields = [
    ['currentPassword', 'auth.currentPassword'],
    ['newPassword', 'auth.newPassword'],
    ['confirmPassword', 'auth.confirmPassword'],
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('profile.changePassword')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(({ currentPassword, newPassword }) =>
              change.mutate(
                { data: { currentPassword, newPassword } },
                {
                  onSuccess: () => {
                    toast.success(t('profile.passwordChanged'));
                    form.reset();
                  },
                },
              ),
            )}
          >
            {fields.map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(label)}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete={
                          name === 'currentPassword' ? 'current-password' : 'new-password'
                        }
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button type="submit" disabled={change.isPending}>
              {change.isPending && <Loader2 className="animate-spin" />}
              {t('common.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const [setup, setSetup] = useState<TwoFactorSetupResponseDto | null>(null);
  const [code, setCode] = useState('');
  const start = useAuthSetupTwoFactor();
  const enable = useAuthEnableTwoFactor();
  const disable = useAuthDisableTwoFactor();

  const done = async () => {
    setSetup(null);
    setCode('');
    toast.success(t('common.saved'));
    await invalidate(getAuthMeQueryKey());
  };

  const codeValid = /^\d{6}$/.test(code);
  const codeInput = (
    <Input
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="123456"
      className="w-36 text-center font-mono tracking-widest"
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
    />
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {enabled ? (
            <ShieldCheck className="size-5 text-emerald-600" />
          ) : (
            <ShieldOff className="text-muted-foreground size-5" />
          )}
          {t('profile.twoFactor')}
        </CardTitle>
        <CardDescription>
          {enabled ? t('profile.twoFactorEnabled') : t('profile.twoFactorDisabled')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {enabled ? (
          <div className="flex flex-wrap items-center gap-2">
            {codeInput}
            <Button
              variant="destructive"
              disabled={!codeValid || disable.isPending}
              onClick={() => disable.mutate({ data: { code } }, { onSuccess: done })}
            >
              {t('profile.disable')}
            </Button>
          </div>
        ) : setup ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t('profile.scanQr')}</p>
            <img
              src={setup.qrCodeDataUrl}
              alt="2FA QR"
              className="size-44 rounded-lg border bg-white p-2"
            />
            <code className="bg-muted block w-fit rounded px-2 py-1 text-xs break-all">
              {setup.secret}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              {codeInput}
              <Button
                disabled={!codeValid || enable.isPending}
                onClick={() => enable.mutate({ data: { code } }, { onSuccess: done })}
              >
                {enable.isPending && <Loader2 className="animate-spin" />}
                {t('profile.verify')}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            disabled={start.isPending}
            onClick={() => start.mutate(undefined, { onSuccess: setSetup })}
          >
            {start.isPending && <Loader2 className="animate-spin" />}
            {t('profile.enable')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function ProfilePage() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  if (!me) return null;
  const { user } = me;

  return (
    <>
      <PageHeader title={t('profile.title')} description={t('profile.subtitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-wrap items-center gap-4 pt-6">
            <Avatar className="size-16 text-lg">
              <AvatarFallback>{initials(user.firstName, user.lastName)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="text-lg font-semibold">
                {user.firstName} {user.lastName}
              </div>
              <div className="text-muted-foreground text-sm">{user.email}</div>
              <div className="flex flex-wrap gap-1">
                {user.isSuperAdmin && <Badge>Super admin</Badge>}
                {me.companies.map((company) => (
                  <Badge
                    key={company.id}
                    variant={company.id === me.activeCompanyId ? 'secondary' : 'outline'}
                  >
                    {company.name}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <ChangePasswordCard />
        <TwoFactorCard enabled={user.twoFactorEnabled} />
      </div>
    </>
  );
}
