import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useBranchesFindAll } from '@/api/generated/endpoints/branches/branches';
import { useRolesFindAll } from '@/api/generated/endpoints/roles/roles';
import {
  getUsersFindAllQueryKey,
  useUsersCreate,
  useUsersUpdate,
} from '@/api/generated/endpoints/users/users';
import type { UserDto } from '@/api/generated/model';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';

const NO_BRANCH = '__none__';

const schema = z.object({
  firstName: v.requiredString(),
  lastName: v.requiredString(),
  email: v.email(),
  phone: z.string().optional(),
  locale: z.enum(['tr', 'en']),
  password: z.union([z.literal(''), v.password()]),
  roleIds: z.array(z.string()),
  defaultBranchId: z.string(),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: UserDto | null;
}

export function UserFormDialog({ open, onOpenChange, user }: UserFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = !!user;
  const invalidate = useInvalidate();
  const { data: roles } = useRolesFindAll({ pageSize: 100 }, { query: { enabled: open } });
  const { data: branches } = useBranchesFindAll({ pageSize: 100 }, { query: { enabled: open } });
  const create = useUsersCreate();
  const update = useUsersUpdate();

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!open) return;
    form.reset({
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      locale: (user?.locale as 'tr' | 'en') ?? 'tr',
      password: '',
      roleIds: user?.roles.map((r) => r.id) ?? [],
      defaultBranchId: user?.defaultBranchId ?? NO_BRANCH,
      isActive: user?.isActive ?? true,
    });
  }, [open, user, form]);

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getUsersFindAllQueryKey());
    onOpenChange(false);
  };

  const onSubmit = (values: FormValues) => {
    const common = {
      firstName: values.firstName,
      lastName: values.lastName,
      phone: values.phone || undefined,
      locale: values.locale,
      roleIds: values.roleIds,
      defaultBranchId: values.defaultBranchId === NO_BRANCH ? undefined : values.defaultBranchId,
    };
    if (isEdit) {
      update.mutate({ id: user.id, data: { ...common, isActive: values.isActive } }, { onSuccess });
    } else {
      create.mutate(
        { data: { ...common, email: values.email, password: values.password || undefined } },
        { onSuccess },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('users.editTitle') : t('users.new')}</DialogTitle>
          {isEdit && <DialogDescription>{user.email}</DialogDescription>}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.firstName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.lastName')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!isEdit && (
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('common.email')}</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.phone')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="locale"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.locale')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="tr">Türkçe</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultBranchId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('users.defaultBranch')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_BRANCH}>{t('common.none')}</SelectItem>
                        {branches?.data.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {!isEdit && (
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>{t('users.passwordOptional')}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            <FormField
              control={form.control}
              name="roleIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('users.roles')}</FormLabel>
                  <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                    {roles?.data.map((role) => (
                      <label key={role.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={field.value.includes(role.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? [...field.value, role.id]
                                : field.value.filter((id) => id !== role.id),
                            )
                          }
                        />
                        {role.name}
                      </label>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            {isEdit && (
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-3">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">{t('common.active')}</FormLabel>
                  </FormItem>
                )}
              />
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
