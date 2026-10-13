import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useCompetenciesCreate,
  useCompetenciesFindAll,
  useCompetenciesRemove,
  useCompetenciesUpdate,
} from '@/api/generated/endpoints/performance/performance';
import type { CompetencyDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { emptyToNull } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { useInvalidatePerformance } from './performance-components';

const schema = z.object({
  name: v.requiredString(),
  description: z.string(),
  sortOrder: z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(0).max(999),
  isActive: z.boolean(),
});

export function CompetenciesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidatePerformance();
  const { data, isLoading } = useCompetenciesFindAll();
  const create = useCompetenciesCreate();
  const update = useCompetenciesUpdate();
  const remove = useCompetenciesRemove();
  const [editor, setEditor] = useState<{ open: boolean; item: CompetencyDto | null }>({
    open: false,
    item: null,
  });
  const canEdit = can('performance:update');
  const canDelete = can('performance:delete');

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate();
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<CompetencyDto, unknown>[]>(
    () => [
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            {row.original.description && (
              <div className="text-muted-foreground max-w-xl text-xs">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'cycleCount',
        header: t('performance.competencies.cycleCount'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.cycleCount}</span>,
      },
      {
        id: 'sortOrder',
        header: t('performance.competencies.sortOrder'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.sortOrder}</span>,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.edit')}
                onClick={() => setEditor({ open: true, item: row.original })}
              >
                <Pencil />
              </Button>
            )}
            {canDelete && row.original.cycleCount === 0 && (
              <ConfirmDialog
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive size-8"
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
                        toast.success(t('performance.competencies.deleted'));
                        await invalidate();
                      },
                    },
                  )
                }
              />
            )}
          </div>
        ),
      },
    ],
    [t, canEdit, canDelete, remove, invalidate],
  );

  return (
    <>
      <Link
        to="/performance"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('performance.cycles.title')}
      </Link>
      <PageHeader
        title={t('performance.competencies.title')}
        description={t('performance.competencies.subtitle')}
        actions={
          can('performance:create') && (
            <Button onClick={() => setEditor({ open: true, item: null })}>
              <Plus /> {t('performance.competencies.new')}
            </Button>
          )
        }
      />
      <DataTable columns={columns} data={data} isLoading={isLoading} searchable={false} />
      <SimpleFormDialog<z.infer<typeof schema>>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={editor.item ? editor.item.name : t('performance.competencies.new')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          name: editor.item?.name ?? '',
          description: editor.item?.description ?? '',
          sortOrder: editor.item?.sortOrder ?? (data?.length ?? 0) + 1,
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'name', label: t('common.name'), wide: true },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
          { name: 'sortOrder', label: t('performance.competencies.sortOrder'), type: 'number' },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
        onSubmit={({ description, ...rest }) => {
          const payload = { ...rest, description: emptyToNull(description) };
          if (editor.item) update.mutate({ id: editor.item.id, data: payload }, { onSuccess });
          else create.mutate({ data: payload }, { onSuccess });
        }}
      />
    </>
  );
}
