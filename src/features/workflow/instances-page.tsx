import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import {
  useWorkflowDefinitionsFindAll,
  useWorkflowInstancesFindAll,
  useWorkflowInstancesStart,
} from '@/api/generated/endpoints/workflow/workflow';
import type { WorkflowStatus } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { tableQuery } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { InstancesTable } from './workflow-components';

const ALL = 'all';
const STATUSES: WorkflowStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];

const startSchema = z.object({
  definitionCode: v.requiredString(),
  entityId: v.requiredString(),
  title: v.requiredString(),
});

/** Generic request starter; business modules will start workflows from their own documents. */
function StartRequestDialog() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: definitions } = useWorkflowDefinitionsFindAll({ query: { enabled: open } });
  const start = useWorkflowInstancesStart();
  const form = useForm({
    resolver: zodResolver(startSchema),
    defaultValues: { definitionCode: '', entityId: '', title: '' },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus /> {t('workflow.newRequest')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('workflow.newRequest')}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              className="space-y-4"
              noValidate
              onSubmit={form.handleSubmit((values) =>
                start.mutate(
                  { data: values },
                  {
                    onSuccess: (instance) =>
                      void navigate({ to: '/workflow/instances/$id', params: { id: instance.id } }),
                  },
                ),
              )}
            >
              <FormField
                control={form.control}
                name="definitionCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workflow.definition')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {definitions
                          ?.filter((d) => d.isActive)
                          .map((d) => (
                            <SelectItem key={d.id} value={d.code}>
                              {d.name}
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
                name="entityId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workflow.entityId')}</FormLabel>
                    <FormControl>
                      <Input placeholder="STA-2026-000002" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workflow.title')}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={start.isPending}>
                  {start.isPending && <Loader2 className="animate-spin" />}
                  {t('common.create')}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function InstancesPage() {
  const { t } = useTranslation();
  const table = useTableState();
  const [status, setStatus] = useState<string>(ALL);
  const [mine, setMine] = useState(false);
  const { data, isLoading } = useWorkflowInstancesFindAll(
    {
      ...table.params,
      status: status === ALL ? undefined : (status as WorkflowStatus),
      mine: mine ? 'true' : undefined,
    },
    { query: tableQuery },
  );

  return (
    <>
      <PageHeader
        title={t('workflow.instancesTitle')}
        description={t('workflow.instancesSubtitle')}
        actions={
          <Can permission="workflow:start">
            <StartRequestDialog />
          </Can>
        }
      />
      <InstancesTable
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        toolbar={
          <>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`workflow.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={mine} onCheckedChange={(c) => setMine(c === true)} />
              {t('workflow.mine')}
            </label>
          </>
        }
      />
    </>
  );
}
