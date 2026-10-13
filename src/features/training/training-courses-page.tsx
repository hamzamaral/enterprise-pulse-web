import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, CalendarPlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useTrainingCoursesCreate,
  useTrainingCoursesFindAll,
  useTrainingCoursesRemove,
  useTrainingCoursesUpdate,
} from '@/api/generated/endpoints/training/training';
import { TrainingCategory, TrainingFormat, type TrainingCourseDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { emptyToNull } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { v } from '@/shared/lib/validation';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { formatHours, useInvalidateTraining } from './training-components';
import { TrainingSessionFormDialog } from './training-session-form-dialog';

const ALL = '__all__';

const schema = z.object({
  code: v.code(),
  title: z.string().trim().min(2, 'validation.required').max(200),
  category: z.nativeEnum(TrainingCategory),
  format: z.nativeEnum(TrainingFormat),
  durationHours: z.coerce
    .number({ invalid_type_error: 'validation.number' })
    .positive()
    .max(1000)
    .refine((n) => Math.abs(n * 10 - Math.round(n * 10)) < 1e-9, 'validation.number'),
  provider: z.string(),
  description: z.string(),
  isMandatory: z.boolean(),
  validityMonths: z.union([
    z.literal(''),
    z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(1).max(120),
  ]),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function TrainingCoursesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidateTraining();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(ALL);
  const [editor, setEditor] = useState<{ open: boolean; item: TrainingCourseDto | null }>({
    open: false,
    item: null,
  });
  const [planFor, setPlanFor] = useState<string | null>(null);
  const { data, isLoading } = useTrainingCoursesFindAll({
    category: category === ALL ? undefined : (category as TrainingCategory),
  });
  const create = useTrainingCoursesCreate();
  const update = useTrainingCoursesUpdate();
  const remove = useTrainingCoursesRemove();
  const canCreate = can('training:create');
  const canEdit = can('training:update');
  const canDelete = can('training:delete');

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    if (!term) return data;
    return data?.filter((c) =>
      [c.code, c.title, c.provider ?? ''].some((v) => v.toLocaleLowerCase('tr').includes(term)),
    );
  }, [data, search]);

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate();
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<TrainingCourseDto, unknown>[]>(
    () => [
      {
        id: 'title',
        header: t('training.course'),
        cell: ({ row }) => (
          <div>
            <span className="inline-flex items-center gap-2 font-medium">
              {row.original.title}
              {row.original.isMandatory && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t('training.courses.mandatory')}
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground block text-xs">
              <code>{row.original.code}</code>
              {row.original.provider && ` · ${row.original.provider}`}
            </span>
          </div>
        ),
      },
      {
        id: 'category',
        header: t('training.category'),
        cell: ({ row }) => (
          <span>
            {t(`training.categories.${row.original.category}`)}
            <span className="text-muted-foreground block text-xs">
              {t(`training.formats.${row.original.format}`)}
            </span>
          </span>
        ),
      },
      {
        id: 'duration',
        header: t('training.courses.duration'),
        cell: ({ row }) => formatHours(row.original.durationHours),
      },
      {
        id: 'validity',
        header: t('training.courses.validity'),
        cell: ({ row }) =>
          row.original.validityMonths
            ? t('training.courses.validityValue', { count: row.original.validityMonths })
            : t('training.courses.noExpiry'),
      },
      {
        id: 'sessions',
        header: t('training.courses.sessions'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.sessionCount}
            {row.original.upcomingCount > 0 && (
              <span className="text-muted-foreground block text-xs">
                {t('training.courses.upcoming', { count: row.original.upcomingCount })}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'attended',
        header: t('training.courses.attended'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.attendedCount}</span>,
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
            {canCreate && row.original.isActive && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('training.courses.plan')}
                title={t('training.courses.plan')}
                onClick={() => setPlanFor(row.original.id)}
              >
                <CalendarPlus />
              </Button>
            )}
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
            {canDelete && row.original.sessionCount === 0 && (
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
                        toast.success(t('training.courses.deleted'));
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
    [t, canCreate, canEdit, canDelete, remove, invalidate],
  );

  const handleExport = async (format: ExportFormat) => {
    await exportTable(
      format,
      'training-courses',
      [
        { header: t('common.code'), value: (r) => r.code },
        { header: t('training.course'), value: (r) => r.title },
        { header: t('training.category'), value: (r) => t(`training.categories.${r.category}`) },
        { header: t('training.format'), value: (r) => t(`training.formats.${r.format}`) },
        { header: t('training.courses.duration'), value: (r) => Number(r.durationHours) },
        { header: t('training.courses.provider'), value: (r) => r.provider },
        {
          header: t('training.courses.mandatory'),
          value: (r) => (r.isMandatory ? t('common.yes') : t('common.no')),
        },
        { header: t('training.courses.validityMonths'), value: (r) => r.validityMonths },
        { header: t('training.courses.sessions'), value: (r) => r.sessionCount },
        { header: t('training.courses.attended'), value: (r) => r.attendedCount },
        {
          header: t('common.status'),
          value: (r) => (r.isActive ? t('common.active') : t('common.inactive')),
        },
      ],
      rows ?? [],
    );
  };

  const item = editor.item;

  return (
    <>
      <Link
        to="/training"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('training.sessions.title')}
      </Link>
      <PageHeader
        title={t('training.courses.title')}
        description={t('training.courses.subtitle')}
        actions={
          canCreate && (
            <Button onClick={() => setEditor({ open: true, item: null })}>
              <Plus /> {t('training.courses.new')}
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchable={false}
        onExport={handleExport}
        toolbar={
          <>
            <div className="relative w-full max-w-xs">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('common.search')}
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48" aria-label={t('training.category')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('training.allCategories')}</SelectItem>
                {Object.values(TrainingCategory).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`training.categories.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <SimpleFormDialog<Values>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={item ? item.title : t('training.courses.new')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: item?.code ?? '',
          title: item?.title ?? '',
          category: item?.category ?? TrainingCategory.TECHNICAL,
          format: item?.format ?? TrainingFormat.CLASSROOM,
          durationHours: item ? Number(item.durationHours) : 8,
          provider: item?.provider ?? '',
          description: item?.description ?? '',
          isMandatory: item?.isMandatory ?? false,
          validityMonths: item?.validityMonths ?? '',
          isActive: item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'ISG-TEMEL' },
          { name: 'title', label: t('training.courses.titleField') },
          {
            name: 'category',
            label: t('training.category'),
            type: 'select',
            required: true,
            options: Object.values(TrainingCategory).map((value) => ({
              value,
              label: t(`training.categories.${value}`),
            })),
          },
          {
            name: 'format',
            label: t('training.format'),
            type: 'select',
            required: true,
            options: Object.values(TrainingFormat).map((value) => ({
              value,
              label: t(`training.formats.${value}`),
            })),
          },
          { name: 'durationHours', label: t('training.courses.durationHours'), type: 'number' },
          { name: 'provider', label: t('training.courses.provider') },
          { name: 'validityMonths', label: t('training.courses.validityMonths'), type: 'number' },
          { name: 'isMandatory', label: t('training.courses.mandatory'), type: 'switch' },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
          ...(item
            ? [{ name: 'isActive' as const, label: t('common.active'), type: 'switch' as const }]
            : []),
        ]}
        onSubmit={({ provider, description, validityMonths, ...rest }) => {
          const payload = {
            ...rest,
            code: rest.code.toUpperCase(),
            provider: emptyToNull(provider),
            description: emptyToNull(description),
            validityMonths: validityMonths === '' ? null : validityMonths,
          };
          if (item) update.mutate({ id: item.id, data: payload }, { onSuccess });
          else create.mutate({ data: payload }, { onSuccess });
        }}
      />
      <TrainingSessionFormDialog
        open={planFor !== null}
        onOpenChange={(open) => !open && setPlanFor(null)}
        courseId={planFor ?? undefined}
        onSaved={(saved) =>
          void navigate({ to: '/training/sessions/$id', params: { id: saved.id } })
        }
      />
    </>
  );
}
