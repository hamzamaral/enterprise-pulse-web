import type { ColumnDef } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getNumberingFindAllQueryKey,
  useNumberingCreate,
  useNumberingFindAll,
  useNumberingUpdate,
} from '@/api/generated/endpoints/numbering/numbering';
import {
  getSettingsFindCurrenciesQueryKey,
  getSettingsFindExchangeRatesQueryKey,
  getSettingsFindTaxRatesQueryKey,
  getSettingsFindUnitsQueryKey,
  useSettingsCreateCurrency,
  useSettingsCreateTaxRate,
  useSettingsCreateUnit,
  useSettingsFindCurrencies,
  useSettingsFindExchangeRates,
  useSettingsFindTaxRates,
  useSettingsFindUnits,
  useSettingsUpdateCurrency,
  useSettingsUpdateTaxRate,
  useSettingsUpdateUnit,
  useSettingsUpsertExchangeRate,
} from '@/api/generated/endpoints/settings/settings';
import type {
  CurrencyDto,
  ExchangeRateDto,
  NumberSequenceDto,
  TaxRateDto,
  UnitDto,
} from '@/api/generated/model';
import { useMe, usePermission } from '@/features/auth/use-session';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';

const number = () => z.coerce.number({ invalid_type_error: 'validation.number' });

/** Edit-or-create dialog state shared by every reference-data tab. */
function useEditor<T>() {
  const [state, setState] = useState<{ open: boolean; item: T | null }>({
    open: false,
    item: null,
  });
  return {
    ...state,
    create: () => setState({ open: true, item: null }),
    edit: (item: T) => setState({ open: true, item }),
    setOpen: (open: boolean) => setState((s) => ({ ...s, open })),
  };
}

function EditButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex justify-end">
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={t('common.edit')}
        onClick={onClick}
      >
        <Pencil />
      </Button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" onClick={onClick}>
      <Plus /> {label}
    </Button>
  );
}

const currencySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'validation.code'),
  name: v.requiredString(),
  symbol: v.requiredString(),
  decimals: number().int().min(0).max(4),
  isActive: z.boolean(),
});

function CurrenciesTab() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const canEdit = !!me?.user.isSuperAdmin;
  const { data, isLoading } = useSettingsFindCurrencies();
  const editor = useEditor<CurrencyDto>();
  const invalidate = useInvalidate();
  const create = useSettingsCreateCurrency();
  const update = useSettingsUpdateCurrency();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getSettingsFindCurrenciesQueryKey());
    editor.setOpen(false);
  };

  const columns = useMemo<ColumnDef<CurrencyDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      { id: 'name', header: t('common.name'), cell: ({ row }) => row.original.name },
      { id: 'symbol', header: t('settings.symbol'), cell: ({ row }) => row.original.symbol },
      { id: 'decimals', header: t('settings.decimals'), cell: ({ row }) => row.original.decimals },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => <EditButton onClick={() => editor.edit(row.original)} />,
            } as ColumnDef<CurrencyDto, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={canEdit && <AddButton label={t('settings.newCurrency')} onClick={editor.create} />}
      />
      <SimpleFormDialog<z.infer<typeof currencySchema>>
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? editor.item.code : t('settings.newCurrency')}
        schema={currencySchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          symbol: editor.item?.symbol ?? '',
          decimals: editor.item?.decimals ?? 2,
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'USD', disabled: !!editor.item },
          { name: 'name', label: t('common.name') },
          { name: 'symbol', label: t('settings.symbol') },
          { name: 'decimals', label: t('settings.decimals'), type: 'number' },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
        onSubmit={({ code, isActive, ...rest }) =>
          editor.item
            ? update.mutate({ code, data: { ...rest, isActive } }, { onSuccess })
            : create.mutate({ data: { code, ...rest } }, { onSuccess })
        }
      />
    </>
  );
}

const rateSchema = z.object({
  currencyCode: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, 'validation.code'),
  rateDate: v.requiredString(),
  buying: number().positive(),
  selling: number().positive(),
});

function ExchangeRatesTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const table = useTableState();
  const { data, isLoading } = useSettingsFindExchangeRates(table.params, { query: tableQuery });
  const [open, setOpen] = useState(false);
  const invalidate = useInvalidate();
  const upsert = useSettingsUpsertExchangeRate();

  const columns = useMemo<ColumnDef<ExchangeRateDto, unknown>[]>(
    () => [
      {
        id: 'rateDate',
        header: t('settings.date'),
        cell: ({ row }) => formatDate(row.original.rateDate),
      },
      {
        id: 'currencyCode',
        header: t('settings.currencies'),
        cell: ({ row }) => <code className="text-xs">{row.original.currencyCode}</code>,
      },
      {
        id: 'buying',
        header: t('settings.buying'),
        enableSorting: false,
        cell: ({ row }) => row.original.buying,
      },
      {
        id: 'selling',
        header: t('settings.selling'),
        enableSorting: false,
        cell: ({ row }) => row.original.selling,
      },
      {
        id: 'source',
        header: t('settings.source'),
        enableSorting: false,
        cell: ({ row }) => <ToneBadge tone="neutral">{row.original.source}</ToneBadge>,
      },
    ],
    [t],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        toolbar={
          canEdit && <AddButton label={t('settings.newRate')} onClick={() => setOpen(true)} />
        }
      />
      <SimpleFormDialog<z.infer<typeof rateSchema>>
        open={open}
        onOpenChange={setOpen}
        title={t('settings.newRate')}
        schema={rateSchema}
        pending={upsert.isPending}
        defaultValues={{
          currencyCode: 'USD',
          rateDate: new Date().toISOString().slice(0, 10),
          buying: 0,
          selling: 0,
        }}
        fields={[
          { name: 'currencyCode', label: t('settings.currencies') },
          { name: 'rateDate', label: t('settings.date'), type: 'date' },
          { name: 'buying', label: t('settings.buying'), type: 'number' },
          { name: 'selling', label: t('settings.selling'), type: 'number' },
        ]}
        onSubmit={(values) =>
          upsert.mutate(
            { data: values },
            {
              onSuccess: async () => {
                toast.success(t('common.saved'));
                await invalidate(getSettingsFindExchangeRatesQueryKey());
                setOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}

const taxSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  rate: number().min(0).max(100),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

function TaxRatesTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSettingsFindTaxRates();
  const editor = useEditor<TaxRateDto>();
  const invalidate = useInvalidate();
  const create = useSettingsCreateTaxRate();
  const update = useSettingsUpdateTaxRate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getSettingsFindTaxRatesQueryKey());
    editor.setOpen(false);
  };

  const columns = useMemo<ColumnDef<TaxRateDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      { id: 'name', header: t('common.name'), cell: ({ row }) => row.original.name },
      {
        id: 'rate',
        header: t('settings.rate'),
        cell: ({ row }) => `%${Number(row.original.rate)}`,
      },
      {
        id: 'isDefault',
        header: t('settings.default'),
        cell: ({ row }) =>
          row.original.isDefault ? (
            <ToneBadge tone="info">{t('settings.default')}</ToneBadge>
          ) : null,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => <EditButton onClick={() => editor.edit(row.original)} />,
            } as ColumnDef<TaxRateDto, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={canEdit && <AddButton label={t('settings.newTaxRate')} onClick={editor.create} />}
      />
      <SimpleFormDialog<z.infer<typeof taxSchema>>
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? editor.item.name : t('settings.newTaxRate')}
        schema={taxSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          rate: editor.item ? Number(editor.item.rate) : 20,
          isDefault: editor.item?.isDefault ?? false,
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'KDV20' },
          { name: 'name', label: t('common.name') },
          { name: 'rate', label: t('settings.rate'), type: 'number' },
          { name: 'isDefault', label: t('settings.default'), type: 'switch' },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
        onSubmit={({ isActive, ...rest }) =>
          editor.item
            ? update.mutate({ id: editor.item.id, data: { ...rest, isActive } }, { onSuccess })
            : create.mutate({ data: rest }, { onSuccess })
        }
      />
    </>
  );
}

const unitSchema = z.object({ code: v.code(), name: v.requiredString(), isActive: z.boolean() });

function UnitsTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading } = useSettingsFindUnits();
  const editor = useEditor<UnitDto>();
  const invalidate = useInvalidate();
  const create = useSettingsCreateUnit();
  const update = useSettingsUpdateUnit();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getSettingsFindUnitsQueryKey());
    editor.setOpen(false);
  };

  const columns = useMemo<ColumnDef<UnitDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      { id: 'name', header: t('common.name'), cell: ({ row }) => row.original.name },
      {
        id: 'isActive',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => <EditButton onClick={() => editor.edit(row.original)} />,
            } as ColumnDef<UnitDto, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={canEdit && <AddButton label={t('settings.newUnit')} onClick={editor.create} />}
      />
      <SimpleFormDialog<z.infer<typeof unitSchema>>
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? editor.item.name : t('settings.newUnit')}
        schema={unitSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          isActive: editor.item?.isActive ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: 'KG' },
          { name: 'name', label: t('common.name') },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
        onSubmit={({ isActive, ...rest }) =>
          editor.item
            ? update.mutate({ id: editor.item.id, data: { ...rest, isActive } }, { onSuccess })
            : create.mutate({ data: rest }, { onSuccess })
        }
      />
    </>
  );
}

const sequenceSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  prefix: v.requiredString(),
  padding: number().int().min(3).max(10),
  includeYear: z.boolean(),
  resetYearly: z.boolean(),
});

function NumberingTab({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const { data, isLoading } = useNumberingFindAll();
  const editor = useEditor<NumberSequenceDto>();
  const invalidate = useInvalidate();
  const create = useNumberingCreate();
  const update = useNumberingUpdate();
  const onSuccess = async () => {
    toast.success(t('common.saved'));
    await invalidate(getNumberingFindAllQueryKey());
    editor.setOpen(false);
  };

  const columns = useMemo<ColumnDef<NumberSequenceDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      { id: 'name', header: t('common.name'), cell: ({ row }) => row.original.name },
      { id: 'prefix', header: t('settings.prefix'), cell: ({ row }) => row.original.prefix },
      { id: 'padding', header: t('settings.padding'), cell: ({ row }) => row.original.padding },
      {
        id: 'preview',
        header: t('settings.nextNumber'),
        cell: ({ row }) => (
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{row.original.preview}</code>
        ),
      },
      ...(canEdit
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }) => <EditButton onClick={() => editor.edit(row.original)} />,
            } as ColumnDef<NumberSequenceDto, unknown>,
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canEdit],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        toolbar={canEdit && <AddButton label={t('settings.newSequence')} onClick={editor.create} />}
      />
      <SimpleFormDialog<z.infer<typeof sequenceSchema>>
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? editor.item.name : t('settings.newSequence')}
        schema={sequenceSchema}
        pending={create.isPending || update.isPending}
        defaultValues={{
          code: editor.item?.code ?? '',
          name: editor.item?.name ?? '',
          prefix: editor.item?.prefix ?? '',
          padding: editor.item?.padding ?? 6,
          includeYear: editor.item?.includeYear ?? true,
          resetYearly: editor.item?.resetYearly ?? true,
        }}
        fields={[
          { name: 'code', label: t('common.code'), disabled: !!editor.item },
          { name: 'name', label: t('common.name') },
          { name: 'prefix', label: t('settings.prefix'), placeholder: 'FTR' },
          { name: 'padding', label: t('settings.padding'), type: 'number' },
          { name: 'includeYear', label: t('settings.includeYear'), type: 'switch' },
          { name: 'resetYearly', label: t('settings.resetYearly'), type: 'switch' },
        ]}
        onSubmit={({ code, ...rest }) =>
          editor.item
            ? update.mutate({ id: editor.item.id, data: rest }, { onSuccess })
            : create.mutate({ data: { code, ...rest } }, { onSuccess })
        }
      />
    </>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const can = usePermission();

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <Tabs defaultValue="taxRates">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="taxRates">{t('settings.taxRates')}</TabsTrigger>
          <TabsTrigger value="units">{t('settings.units')}</TabsTrigger>
          <TabsTrigger value="currencies">{t('settings.currencies')}</TabsTrigger>
          <TabsTrigger value="exchangeRates">{t('settings.exchangeRates')}</TabsTrigger>
          {can('numbering:read') && (
            <TabsTrigger value="numbering">{t('settings.numbering')}</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="taxRates">
          <TaxRatesTab canEdit={can('settings:update')} />
        </TabsContent>
        <TabsContent value="units">
          <UnitsTab canEdit={can('settings:update')} />
        </TabsContent>
        <TabsContent value="currencies">
          <CurrenciesTab />
        </TabsContent>
        <TabsContent value="exchangeRates">
          <ExchangeRatesTab canEdit={can('settings:update')} />
        </TabsContent>
        {can('numbering:read') && (
          <TabsContent value="numbering">
            <NumberingTab canEdit={can('numbering:update')} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}
