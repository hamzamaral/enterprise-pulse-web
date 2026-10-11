import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { getAuthMeQueryKey } from '@/api/generated/endpoints/auth/auth';
import {
  getCompaniesFindAllQueryKey,
  useCompaniesCreate,
  useCompaniesFindAll,
  useCompaniesUpdate,
} from '@/api/generated/endpoints/companies/companies';
import type { CompanyDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';

const schema = z.object({
  code: v.code(),
  name: v.requiredString(),
  legalName: z.string().optional(),
  taxNumber: z.string().optional(),
  taxOffice: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('validation.email')]).optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  baseCurrency: z.string().regex(/^[A-Z]{3}$/, 'validation.code'),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const clean = ({ isActive, ...values }: FormValues) => ({
  isActive,
  data: Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === '' ? undefined : value]),
  ) as Omit<FormValues, 'isActive'>,
});

export function CompaniesPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'name', desc: false }] });
  const { data, isLoading } = useCompaniesFindAll(table.params, { query: tableQuery });
  const [editing, setEditing] = useState<CompanyDto | null>(null);
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidate();
  const create = useCompaniesCreate();
  const update = useCompaniesUpdate();

  const onSaved = async () => {
    toast.success(t('common.saved'));
    await invalidate(getCompaniesFindAllQueryKey(), getAuthMeQueryKey());
    setOpen(false);
  };

  const columns = useMemo<ColumnDef<CompanyDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      {
        id: 'name',
        header: t('common.name'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-muted-foreground text-xs">{row.original.legalName}</div>
          </div>
        ),
      },
      {
        id: 'taxNumber',
        header: t('organization.taxNumber'),
        enableSorting: false,
        cell: ({ row }) => row.original.taxNumber ?? '—',
      },
      {
        id: 'city',
        header: t('common.city'),
        enableSorting: false,
        cell: ({ row }) => row.original.city ?? '—',
      },
      {
        id: 'baseCurrency',
        header: t('organization.baseCurrency'),
        enableSorting: false,
        cell: ({ row }) => row.original.baseCurrency,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) =>
          can('companies:update') && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.edit')}
                onClick={() => {
                  setEditing(row.original);
                  setOpen(true);
                }}
              >
                <Pencil />
              </Button>
            </div>
          ),
      },
    ],
    [t, can],
  );

  return (
    <>
      <PageHeader
        title={t('organization.companiesTitle')}
        description={t('organization.companiesSubtitle')}
        actions={
          <Can permission="companies:create">
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus /> {t('organization.newCompany')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
      />
      <SimpleFormDialog<FormValues>
        open={open}
        onOpenChange={setOpen}
        title={editing ? t('common.edit') : t('organization.newCompany')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editing?.code ?? '',
          name: editing?.name ?? '',
          legalName: editing?.legalName ?? '',
          taxNumber: editing?.taxNumber ?? '',
          taxOffice: editing?.taxOffice ?? '',
          email: editing?.email ?? '',
          phone: editing?.phone ?? '',
          city: editing?.city ?? '',
          baseCurrency: editing?.baseCurrency ?? 'TRY',
          isActive: editing?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), disabled: !!editing },
          { name: 'name', label: t('common.name') },
          { name: 'legalName', label: t('organization.legalName'), wide: true },
          { name: 'taxNumber', label: t('organization.taxNumber') },
          { name: 'taxOffice', label: t('organization.taxOffice') },
          { name: 'email', label: t('common.email'), type: 'email' },
          { name: 'phone', label: t('common.phone') },
          { name: 'city', label: t('common.city') },
          { name: 'baseCurrency', label: t('organization.baseCurrency') },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
        onSubmit={(values) => {
          const { isActive, data: body } = clean(values);
          if (editing)
            update.mutate({ id: editing.id, data: { ...body, isActive } }, { onSuccess: onSaved });
          else create.mutate({ data: body }, { onSuccess: onSaved });
        }}
      />
    </>
  );
}
