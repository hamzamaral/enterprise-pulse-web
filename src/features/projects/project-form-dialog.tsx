import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useProjectsCreate, useProjectsUpdate } from '@/api/generated/endpoints/projects/projects';
import type { ProjectDetailDto, ProjectStatus } from '@/api/generated/model';
import { useMe } from '@/features/auth/use-session';
import { useEmployeeOptions } from '@/features/hr/hr-components';
import { PartnerField, type PartnerOption } from '@/features/partners/partner-components';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { PROJECT_STATUSES, WORKING_STATUSES, useInvalidateProjects } from './project-components';

const toNumber = (value: string) => Number(value.replace(',', '.'));

const schema = z
  .object({
    name: z.string().trim().min(2, 'validation.required'),
    partner: z.custom<PartnerOption | null>(),
    managerId: z.string().min(1, 'validation.required'),
    status: z.string(),
    startDate: z.string(),
    dueDate: z.string(),
    budgetAmount: z
      .string()
      .trim()
      .refine((value) => !value || toNumber(value) > 0, 'validation.number'),
    description: z.string(),
  })
  .refine((v) => !v.startDate || !v.dueDate || v.dueDate >= v.startDate, {
    path: ['dueDate'],
    message: 'projects.validation.dueBeforeStart',
  });
type FormValues = z.infer<typeof schema>;

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectDetailDto;
  onSaved?: (project: ProjectDetailDto) => void;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const create = useProjectsCreate();
  const update = useProjectsUpdate();
  const invalidate = useInvalidateProjects();
  const employees = useEmployeeOptions(open);
  const managers =
    project && !employees.some((e) => e.value === project.managerId)
      ? [{ value: project.managerId, label: project.managerName }, ...employees]
      : employees;
  const statuses = project ? PROJECT_STATUSES : WORKING_STATUSES;

  const defaults = (): FormValues => ({
    name: project?.name ?? '',
    partner:
      project?.partnerId && project.partnerCode && project.partnerTitle
        ? { id: project.partnerId, code: project.partnerCode, title: project.partnerTitle }
        : null,
    managerId: project?.managerId ?? me?.employeeId ?? '',
    status: project?.status ?? 'PLANNED',
    startDate: project?.startDate ?? '',
    dueDate: project?.dueDate ?? '',
    budgetAmount: project?.budgetAmount ? String(Number(project.budgetAmount)) : '',
    description: project?.description ?? '',
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSuccess = async (saved: ProjectDetailDto) => {
    toast.success(project ? t('common.saved') : t('projects.created', { number: saved.number }));
    await invalidate();
    onOpenChange(false);
    onSaved?.(saved);
  };

  const submit = (values: FormValues) => {
    const data = {
      name: values.name,
      partnerId: values.partner?.id ?? null,
      managerId: values.managerId,
      status: values.status as ProjectStatus,
      startDate: values.startDate || null,
      dueDate: values.dueDate || null,
      budgetAmount: values.budgetAmount ? toNumber(values.budgetAmount) : null,
      description: values.description.trim() || null,
    };
    if (project) update.mutate({ id: project.id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {project ? `${project.number} · ${project.name}` : t('projects.new')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('projects.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="sm:col-span-2">
                <PartnerField
                  control={form.control}
                  name="partner"
                  label={t('projects.customerOptional')}
                  type="CUSTOMER"
                />
              </div>
              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.manager')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t('common.select')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {managers.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.status')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {statuses.map((status) => (
                          <SelectItem key={status} value={status}>
                            {t(`projects.status.${status}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.startDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.dueDate')}</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="budgetAmount"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('projects.budget')}</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
                    <FormDescription>{t('projects.budgetHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
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
