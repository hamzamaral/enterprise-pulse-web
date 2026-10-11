import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useRolesFindAll } from '@/api/generated/endpoints/roles/roles';
import { useUsersFindAll } from '@/api/generated/endpoints/users/users';
import {
  getWorkflowDefinitionsFindAllQueryKey,
  useWorkflowDefinitionsCreate,
  useWorkflowDefinitionsFindAll,
  useWorkflowDefinitionsUpdate,
} from '@/api/generated/endpoints/workflow/workflow';
import type { WorkflowDefinitionDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge } from '@/shared/components/status-badge';
import { useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Switch } from '@/shared/ui/switch';

const stepSchema = z.object({
  name: v.requiredString(),
  approverType: z.enum(['ROLE', 'USER']),
  approverId: v.requiredString(),
});

const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z][A-Z0-9_]{1,49}$/, 'validation.code'),
  name: v.requiredString(),
  entityType: v.requiredString(),
  description: z.string().trim(),
  steps: z.array(stepSchema).min(1, 'validation.required'),
});

type FormValues = z.infer<typeof schema>;

const emptyValues: FormValues = {
  code: '',
  name: '',
  entityType: '',
  description: '',
  steps: [{ name: '', approverType: 'ROLE', approverId: '' }],
};

function toFormValues(definition: WorkflowDefinitionDto): FormValues {
  return {
    code: definition.code,
    name: definition.name,
    entityType: definition.entityType,
    description: definition.description ?? '',
    steps: definition.steps.map((s) => ({
      name: s.name,
      approverType: s.approverType,
      approverId: (s.approverType === 'ROLE' ? s.approverRoleId : s.approverUserId) ?? '',
    })),
  };
}

function DefinitionDialog({
  open,
  onOpenChange,
  definition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  definition: WorkflowDefinitionDto | null;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const create = useWorkflowDefinitionsCreate();
  const update = useWorkflowDefinitionsUpdate();
  const { data: roles } = useRolesFindAll({ pageSize: 100 }, { query: { enabled: open } });
  const { data: users } = useUsersFindAll(
    { pageSize: 100, isActive: 'true' },
    { query: { enabled: open } },
  );

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: emptyValues });
  const steps = useFieldArray({ control: form.control, name: 'steps' });
  const stepValues = useWatch({ control: form.control, name: 'steps' });

  useEffect(() => {
    if (open) form.reset(definition ? toFormValues(definition) : emptyValues);
  }, [open, definition, form]);

  const onSubmit = (values: FormValues) => {
    const payload = {
      name: values.name,
      entityType: values.entityType,
      description: values.description || undefined,
      steps: values.steps.map((s) => ({
        name: s.name,
        approverType: s.approverType,
        approverRoleId: s.approverType === 'ROLE' ? s.approverId : undefined,
        approverUserId: s.approverType === 'USER' ? s.approverId : undefined,
      })),
    };
    const onSuccess = async () => {
      toast.success(t('common.saved'));
      await invalidate(getWorkflowDefinitionsFindAllQueryKey());
      onOpenChange(false);
    };
    if (definition) update.mutate({ id: definition.id, data: payload }, { onSuccess });
    else create.mutate({ data: { ...payload, code: values.code } }, { onSuccess });
  };

  const pending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{definition ? definition.name : t('workflow.newDefinition')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.code')}</FormLabel>
                    <FormControl>
                      <Input placeholder="PURCHASE_REQUEST" disabled={!!definition} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('common.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workflow.entityType')}</FormLabel>
                    <FormControl>
                      <Input placeholder="PurchaseRequest" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="sm:col-span-3">
                    <FormLabel>{t('common.description')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t('workflow.steps')}</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => steps.append({ name: '', approverType: 'ROLE', approverId: '' })}
                >
                  <Plus /> {t('workflow.addStep')}
                </Button>
              </div>
              {steps.fields.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-muted/30 grid items-start gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_10rem_1fr_auto]"
                >
                  <span className="bg-primary text-primary-foreground mt-1.5 flex size-6 items-center justify-center rounded-full text-xs">
                    {index + 1}
                  </span>
                  <FormField
                    control={form.control}
                    name={`steps.${index}.name`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder={t('workflow.stepName')} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`steps.${index}.approverType`}
                    render={({ field }) => (
                      <FormItem>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue(`steps.${index}.approverId`, '');
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ROLE">{t('workflow.role')}</SelectItem>
                            <SelectItem value="USER">{t('workflow.user')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`steps.${index}.approverId`}
                    render={({ field }) => (
                      <FormItem>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t('workflow.approver')} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {stepValues?.[index]?.approverType === 'USER'
                              ? users?.data.map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.firstName} {u.lastName}
                                  </SelectItem>
                                ))
                              : roles?.data.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.name}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={steps.fields.length === 1}
                    onClick={() => steps.remove(index)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
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

export function DefinitionsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useWorkflowDefinitionsFindAll();
  const canUpdate = usePermission()('workflow:update');
  const update = useWorkflowDefinitionsUpdate();
  const invalidate = useInvalidate();
  const [dialog, setDialog] = useState<{ open: boolean; definition: WorkflowDefinitionDto | null }>(
    {
      open: false,
      definition: null,
    },
  );

  return (
    <>
      <PageHeader
        title={t('workflow.definitionsTitle')}
        description={t('workflow.definitionsSubtitle')}
        actions={
          <Can permission="workflow:create">
            <Button onClick={() => setDialog({ open: true, definition: null })}>
              <Plus /> {t('workflow.newDefinition')}
            </Button>
          </Can>
        }
      />
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((definition) => (
            <Card key={definition.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {definition.name} <ActiveBadge active={definition.isActive} />
                  </CardTitle>
                  <CardDescription>
                    <code>{definition.code}</code> · {definition.entityType}
                  </CardDescription>
                </div>
                {canUpdate && (
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={definition.isActive}
                      onCheckedChange={(isActive) =>
                        update.mutate(
                          { id: definition.id, data: { isActive } },
                          {
                            onSuccess: () =>
                              void invalidate(getWorkflowDefinitionsFindAllQueryKey()),
                          },
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDialog({ open: true, definition })}
                    >
                      <Pencil />
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {definition.description && (
                  <p className="text-muted-foreground mb-3 text-sm">{definition.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {definition.steps.map((step, i) => (
                    <span key={step.id} className="flex items-center gap-2">
                      {i > 0 && <ArrowRight className="text-muted-foreground size-4" />}
                      <Badge variant="secondary">
                        {step.order}. {step.name}
                      </Badge>
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground py-12 text-center text-sm">{t('common.noResults')}</p>
      )}
      <DefinitionDialog
        open={dialog.open}
        definition={dialog.definition}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </>
  );
}
