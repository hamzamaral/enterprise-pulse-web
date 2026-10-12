import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Trash2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useProjectsCreateTask,
  useProjectTasksRemove,
  useProjectTasksUpdate,
} from '@/api/generated/endpoints/projects/projects';
import type {
  ProjectDetailDto,
  ProjectTaskDto,
  ProjectTaskPriority,
  ProjectTaskStatus,
} from '@/api/generated/model';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { formatDateTime } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
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
import { Textarea } from '@/shared/ui/textarea';
import {
  PriorityIcon,
  TASK_PRIORITIES,
  TASK_STATUSES,
  useFormatHours,
  useInvalidateProjects,
} from './project-components';

const NONE = '__none__';
const toNumber = (value: string) => Number(value.replace(',', '.'));

const schema = z.object({
  title: z.string().trim().min(2, 'validation.required'),
  description: z.string(),
  status: z.string(),
  priority: z.string(),
  assigneeId: z.string(),
  dueDate: z.string(),
  estimatedHours: z
    .string()
    .trim()
    .refine(
      (value) => !value || (toNumber(value) > 0 && toNumber(value) <= 10000),
      'validation.number',
    ),
});
type FormValues = z.infer<typeof schema>;

/** Creates a task in `status` or edits `task`; members work on tasks, managers also delete them. */
export function TaskFormDialog({
  open,
  onOpenChange,
  project,
  task,
  status,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: ProjectDetailDto;
  task?: ProjectTaskDto | null;
  status?: ProjectTaskStatus;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const hours = useFormatHours();
  const create = useProjectsCreateTask();
  const update = useProjectTasksUpdate();
  const remove = useProjectTasksRemove();
  const invalidate = useInvalidateProjects();

  const defaults = (): FormValues => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? status ?? 'TODO',
    priority: task?.priority ?? 'MEDIUM',
    assigneeId: task?.assigneeId ?? NONE,
    dueDate: task?.dueDate ?? '',
    estimatedHours: task?.estimatedHours ? String(Number(task.estimatedHours)) : '',
  });
  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults() });

  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const done = async (message: string) => {
    toast.success(message);
    await invalidate();
    onOpenChange(false);
  };

  const submit = (values: FormValues) => {
    const data = {
      title: values.title,
      description: values.description.trim() || null,
      status: values.status as ProjectTaskStatus,
      priority: values.priority as ProjectTaskPriority,
      assigneeId: values.assigneeId === NONE ? null : values.assigneeId,
      dueDate: values.dueDate || null,
      estimatedHours: values.estimatedHours ? toNumber(values.estimatedHours) : null,
    };
    if (task) {
      update.mutate({ id: task.id, data }, { onSuccess: () => done(t('common.saved')) });
    } else {
      create.mutate(
        { id: project.id, data },
        { onSuccess: (saved) => done(t('projects.tasks.created', { no: saved.taskNo })) },
      );
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {task ? `#${task.taskNo} · ${task.title}` : t('projects.tasks.new')}
          </DialogTitle>
          {task && (
            <DialogDescription>
              {t('projects.tasks.logged', {
                logged: hours(task.loggedHours),
                estimate: hours(task.estimatedHours),
              })}
              {task.completedAt &&
                ` · ${t('projects.tasks.completedAt', { date: formatDateTime(task.completedAt) })}`}
            </DialogDescription>
          )}
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
            <fieldset disabled={readOnly} className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>{t('projects.tasks.title')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_STATUSES.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(`projects.taskStatus.${value}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.tasks.priority')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {TASK_PRIORITIES.map((value) => (
                          <SelectItem key={value} value={value}>
                            <PriorityIcon priority={value} withLabel />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.tasks.assignee')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>{t('projects.tasks.unassigned')}</SelectItem>
                        {project.members.map((m) => (
                          <SelectItem key={m.employeeId} value={m.employeeId}>
                            {m.employeeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('projects.tasks.estimate')}</FormLabel>
                    <FormControl>
                      <Input inputMode="decimal" {...field} />
                    </FormControl>
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
                      <Textarea rows={4} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </fieldset>
            <DialogFooter className="gap-2 sm:justify-between">
              <div>
                {task && project.canManage && !readOnly && (
                  <ConfirmDialog
                    trigger={
                      <Button type="button" variant="outline" className="text-destructive">
                        <Trash2 /> {t('common.delete')}
                      </Button>
                    }
                    onConfirm={() =>
                      remove.mutate({ id: task.id }, { onSuccess: () => done(t('common.deleted')) })
                    }
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  {readOnly ? t('common.close') : t('common.cancel')}
                </Button>
                {!readOnly && (
                  <Button type="submit" disabled={pending}>
                    {pending && <Loader2 className="animate-spin" />}
                    {t('common.save')}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
