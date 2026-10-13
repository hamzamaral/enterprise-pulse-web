import type { ColumnDef } from '@tanstack/react-table';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useTicketCategoriesCreate,
  useTicketCategoriesFindAll,
  useTicketCategoriesRemove,
  useTicketCategoriesUpdate,
  useTicketSlaPoliciesFindAll,
  useTicketSlaPoliciesUpdate,
} from '@/api/generated/endpoints/support/support';
import type { TicketCategoryDto, TicketSlaPolicyDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import { TicketPriorityBadge, useAgentOptions, useInvalidateSupport } from './support-components';

const schema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(100),
  description: z.string().max(500),
  defaultAssigneeId: z.string(),
  sortOrder: z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(0).max(999),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Ticket categories with their default assignee, and the SLA targets per priority. */
export function SupportSettingsPage() {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const agents = useAgentOptions();
  const { data, isLoading } = useTicketCategoriesFindAll();
  const create = useTicketCategoriesCreate();
  const update = useTicketCategoriesUpdate();
  const remove = useTicketCategoriesRemove();
  const [editor, setEditor] = useState<{ open: boolean; item: TicketCategoryDto | null }>({
    open: false,
    item: null,
  });
  const item = editor.item;

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate();
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<TicketCategoryDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.name}</span>
            {row.original.description && (
              <span className="text-muted-foreground block text-xs">
                {row.original.description}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'assignee',
        header: t('support.settings.defaultAssignee'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.defaultAssigneeName ?? (
            <span className="text-muted-foreground">{t('support.settings.queueOnly')}</span>
          ),
      },
      {
        id: 'tickets',
        header: t('support.settings.tickets'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.activeCount} / {row.original.ticketCount}
          </span>
        ),
      },
      {
        id: 'sortOrder',
        header: t('support.settings.sortOrder'),
        enableSorting: false,
        cell: ({ row }) => <span className="tabular-nums">{row.original.sortOrder}</span>,
      },
      {
        id: 'active',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          row.original.ticketCount === 0 && (
            <span onClick={(e) => e.stopPropagation()}>
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t('common.delete')}
                  >
                    <Trash2 />
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id: row.original.id },
                    {
                      onSuccess: async () => {
                        toast.success(t('support.settings.categoryDeleted'));
                        await invalidate();
                      },
                    },
                  )
                }
              />
            </span>
          ),
      },
    ],
    [t, remove, invalidate],
  );

  return (
    <>
      <PageHeader
        title={t('support.settings.title')}
        description={t('support.settings.subtitle')}
        actions={
          <Button onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('support.settings.newCategory')}
          </Button>
        }
      />
      <SlaCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('support.settings.categories')}</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            searchable={false}
            onRowClick={(row) => setEditor({ open: true, item: row })}
          />
        </CardContent>
      </Card>
      <SimpleFormDialog<Values>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={item ? item.name : t('support.settings.newCategory')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          name: item?.name ?? '',
          description: item?.description ?? '',
          defaultAssigneeId: item?.defaultAssigneeId ?? '',
          sortOrder: item?.sortOrder ?? ((data?.length ?? 0) + 1) * 10,
          isActive: item?.isActive ?? true,
        }}
        fields={[
          { name: 'name', label: t('common.name') },
          {
            name: 'defaultAssigneeId',
            label: t('support.settings.defaultAssignee'),
            type: 'select',
            options: agents,
          },
          { name: 'sortOrder', label: t('support.settings.sortOrder'), type: 'number' },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
        ]}
        onSubmit={({ description, defaultAssigneeId, ...rest }) => {
          const payload = {
            ...rest,
            description: emptyToNull(description),
            defaultAssigneeId: defaultAssigneeId || null,
          };
          if (item) update.mutate({ id: item.id, data: payload }, { onSuccess });
          else create.mutate({ data: payload }, { onSuccess });
        }}
      />
    </>
  );
}

function SlaCard() {
  const { t } = useTranslation();
  const { data } = useTicketSlaPoliciesFindAll();
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{t('support.settings.sla')}</CardTitle>
        <p className="text-muted-foreground text-sm">{t('support.settings.slaHint')}</p>
      </CardHeader>
      <CardContent>
        {data ? (
          <SlaForm key={JSON.stringify(data)} policies={data} />
        ) : (
          <Skeleton className="h-40" />
        )}
      </CardContent>
    </Card>
  );
}

function SlaForm({ policies }: { policies: TicketSlaPolicyDto[] }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateSupport();
  const save = useTicketSlaPoliciesUpdate();
  const [rows, setRows] = useState(() =>
    policies.map((p) => ({
      ...p,
      firstResponseHours: String(p.firstResponseHours),
      resolutionHours: String(p.resolutionHours),
    })),
  );
  const parsed = rows.map((r) => ({
    priority: r.priority,
    firstResponseHours: Number(r.firstResponseHours),
    resolutionHours: Number(r.resolutionHours),
  }));
  const invalid = parsed.some(
    (p) =>
      !Number.isInteger(p.firstResponseHours) ||
      !Number.isInteger(p.resolutionHours) ||
      p.firstResponseHours < 1 ||
      p.firstResponseHours > 720 ||
      p.resolutionHours > 2160 ||
      p.resolutionHours < p.firstResponseHours,
  );
  const dirty = parsed.some(
    (p, i) =>
      p.firstResponseHours !== policies[i]?.firstResponseHours ||
      p.resolutionHours !== policies[i]?.resolutionHours,
  );

  const set = (index: number, field: 'firstResponseHours' | 'resolutionHours', value: string) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, [field]: value } : r)));

  return (
    <div className="space-y-3">
      <div className="grid max-w-xl grid-cols-[8rem_1fr_1fr] items-center gap-3 text-xs">
        <span className="text-muted-foreground">{t('support.priorityLabel')}</span>
        <span className="text-muted-foreground">{t('support.settings.responseHours')}</span>
        <span className="text-muted-foreground">{t('support.settings.resolutionHours')}</span>
        {rows.map((row, index) => (
          <SlaRow
            key={row.priority}
            row={row}
            onChange={(field, value) => set(index, field, value)}
          />
        ))}
      </div>
      {invalid && <p className="text-destructive text-sm">{t('support.settings.slaInvalid')}</p>}
      <Button
        disabled={!dirty || invalid || save.isPending}
        onClick={() =>
          save.mutate(
            { data: { policies: parsed } },
            {
              onSuccess: async () => {
                toast.success(t('common.saved'));
                await invalidate();
              },
            },
          )
        }
      >
        {save.isPending && <Loader2 className="animate-spin" />}
        {t('common.save')}
      </Button>
    </div>
  );
}

function SlaRow({
  row,
  onChange,
}: {
  row: {
    priority: TicketSlaPolicyDto['priority'];
    firstResponseHours: string;
    resolutionHours: string;
  };
  onChange: (field: 'firstResponseHours' | 'resolutionHours', value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <span>
        <TicketPriorityBadge priority={row.priority} />
      </span>
      <Input
        type="number"
        min={1}
        className="h-8"
        aria-label={`${t(`support.priority.${row.priority}`)} · ${t('support.settings.responseHours')}`}
        value={row.firstResponseHours}
        onChange={(e) => onChange('firstResponseHours', e.target.value)}
      />
      <Input
        type="number"
        min={1}
        className="h-8"
        aria-label={`${t(`support.priority.${row.priority}`)} · ${t('support.settings.resolutionHours')}`}
        value={row.resolutionHours}
        onChange={(e) => onChange('resolutionHours', e.target.value)}
      />
    </>
  );
}
