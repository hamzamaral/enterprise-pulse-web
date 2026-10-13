import type { ColumnDef } from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useContractTypesCreate,
  useContractTypesFindAll,
  useContractTypesRemove,
  useContractTypesUpdate,
} from '@/api/generated/endpoints/contracts/contracts';
import type { ContractFlow, ContractParty, ContractTypeDto } from '@/api/generated/model';
import { emptyToNull } from '@/features/hr/hr-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';
import { useInvalidateContracts } from './contract-components';

const PARTIES: ContractParty[] = ['PARTNER', 'EMPLOYEE'];
const FLOWS: ContractFlow[] = ['INCOME', 'EXPENSE', 'NONE'];

const schema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(100),
  party: z.string().min(1, 'validation.required'),
  flow: z.string().min(1, 'validation.required'),
  defaultTermMonths: z
    .string()
    .refine(
      (v) => !v || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 240),
      'validation.number',
    ),
  defaultNoticeDays: z.coerce
    .number({ invalid_type_error: 'validation.number' })
    .int()
    .min(0)
    .max(365),
  sortOrder: z.coerce.number({ invalid_type_error: 'validation.number' }).int().min(0).max(999),
  isActive: z.boolean(),
  description: z.string().max(500),
});
type Values = z.infer<typeof schema>;

/** Contract types: party, money direction and defaults for new contracts. */
export function ContractTypesPage() {
  const { t } = useTranslation();
  const invalidate = useInvalidateContracts();
  const { data, isLoading } = useContractTypesFindAll();
  const create = useContractTypesCreate();
  const update = useContractTypesUpdate();
  const remove = useContractTypesRemove();
  const [editor, setEditor] = useState<{ open: boolean; item: ContractTypeDto | null }>({
    open: false,
    item: null,
  });
  const item = editor.item;

  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate();
    setEditor((s) => ({ ...s, open: false }));
  };

  const columns = useMemo<ColumnDef<ContractTypeDto, unknown>[]>(
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
        id: 'party',
        header: t('contracts.partyLabel'),
        enableSorting: false,
        cell: ({ row }) => t(`contracts.party.${row.original.party}`),
      },
      {
        id: 'flow',
        header: t('contracts.types.flow'),
        enableSorting: false,
        cell: ({ row }) => t(`contracts.flow.${row.original.flow}`),
      },
      {
        id: 'defaults',
        header: t('contracts.types.defaults'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.defaultTermMonths
              ? t('contracts.types.termValue', { count: row.original.defaultTermMonths })
              : t('contracts.openEnded')}
            <span className="text-muted-foreground block text-xs">
              {t('contracts.noticeDaysValue', { count: row.original.defaultNoticeDays })}
            </span>
          </span>
        ),
      },
      {
        id: 'contracts',
        header: t('contracts.types.contracts'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.activeCount} / {row.original.contractCount}
          </span>
        ),
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
          row.original.contractCount === 0 && (
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
                        toast.success(t('contracts.types.deleted'));
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
        title={t('contracts.types.title')}
        description={t('contracts.types.subtitle')}
        actions={
          <Button onClick={() => setEditor({ open: true, item: null })}>
            <Plus /> {t('contracts.types.new')}
          </Button>
        }
      />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        onRowClick={(row) => setEditor({ open: true, item: row })}
      />
      <SimpleFormDialog<Values>
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        title={item ? item.name : t('contracts.types.new')}
        schema={schema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          name: item?.name ?? '',
          party: item?.party ?? 'PARTNER',
          flow: item?.flow ?? 'NONE',
          defaultTermMonths: item?.defaultTermMonths ? String(item.defaultTermMonths) : '',
          defaultNoticeDays: item?.defaultNoticeDays ?? 30,
          sortOrder: item?.sortOrder ?? ((data?.length ?? 0) + 1) * 10,
          isActive: item?.isActive ?? true,
          description: item?.description ?? '',
        }}
        fields={[
          { name: 'name', label: t('common.name'), wide: true },
          {
            name: 'party',
            label: t('contracts.partyLabel'),
            type: 'select',
            required: true,
            disabled: !!item?.contractCount,
            options: PARTIES.map((value) => ({ value, label: t(`contracts.party.${value}`) })),
          },
          {
            name: 'flow',
            label: t('contracts.types.flow'),
            type: 'select',
            required: true,
            options: FLOWS.map((value) => ({ value, label: t(`contracts.flow.${value}`) })),
          },
          {
            name: 'defaultTermMonths',
            label: t('contracts.types.defaultTermMonths'),
            type: 'number',
          },
          {
            name: 'defaultNoticeDays',
            label: t('contracts.types.defaultNoticeDays'),
            type: 'number',
          },
          { name: 'sortOrder', label: t('contracts.types.sortOrder'), type: 'number' },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
          { name: 'description', label: t('common.description'), type: 'textarea', wide: true },
        ]}
        onSubmit={({ description, defaultTermMonths, party, flow, ...rest }) => {
          const payload = {
            ...rest,
            party: party as ContractParty,
            flow: flow as ContractFlow,
            defaultTermMonths: defaultTermMonths ? Number(defaultTermMonths) : null,
            description: emptyToNull(description),
          };
          if (item) update.mutate({ id: item.id, data: payload }, { onSuccess });
          else create.mutate({ data: payload }, { onSuccess });
        }}
      />
    </>
  );
}
