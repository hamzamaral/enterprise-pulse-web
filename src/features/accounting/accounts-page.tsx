import type { ColumnDef } from '@tanstack/react-table';
import { useNavigate } from '@tanstack/react-router';
import { Loader2, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  useLedgerAccountsCreate,
  useLedgerAccountsFindAll,
  useLedgerAccountsInstall,
  useLedgerAccountsRemove,
  useLedgerAccountsUpdate,
} from '@/api/generated/endpoints/accounting/accounting';
import { LedgerAccountType, type LedgerAccountDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge, ToneBadge } from '@/shared/components/status-badge';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import {
  AccountTypeBadge,
  AmountCell,
  BalanceCell,
  levelIndent,
  useInvalidateAccounting,
} from './accounting-components';
import { ACCOUNT_CODE, nextChildCode } from './account-codes';

const ALL = '__all__';
const VIEWS = ['active', 'used', 'inactive'] as const;
type View = (typeof VIEWS)[number];

const createSchema = z.object({
  code: z.string().trim().regex(ACCOUNT_CODE, 'accounting.accounts.codeInvalid'),
  name: z.string().trim().min(2, 'validation.required').max(150),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().trim().min(2, 'validation.required').max(150),
  isActive: z.boolean(),
});

type Dialog =
  | { kind: 'create'; parent?: LedgerAccountDto }
  | { kind: 'edit'; account: LedgerAccountDto }
  | null;

/** Hesap planı: Tekdüzen main accounts with sub-accounts and their balances. */
export function AccountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const currency = useBaseCurrency();
  const invalidate = useInvalidateAccounting();
  const { data: accounts, isLoading } = useLedgerAccountsFindAll();
  const create = useLedgerAccountsCreate();
  const update = useLedgerAccountsUpdate();
  const remove = useLedgerAccountsRemove();
  const install = useLedgerAccountsInstall();
  const [search, setSearch] = useState('');
  const [type, setType] = useState(ALL);
  const [view, setView] = useState<View>('active');
  const [dialog, setDialog] = useState<Dialog>(null);
  const canUpdate = can('accounting:update');

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    return (accounts ?? [])
      .filter((a) => (view === 'inactive' ? !a.isActive : a.isActive))
      .filter((a) => view !== 'used' || Number(a.debit) !== 0 || Number(a.credit) !== 0)
      .filter((a) => type === ALL || a.type === type)
      .filter(
        (a) => !term || a.code.startsWith(term) || a.name.toLocaleLowerCase('tr').includes(term),
      );
  }, [accounts, search, type, view]);

  const columns = useMemo<ColumnDef<LedgerAccountDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('accounting.accounts.code'),
        cell: ({ row }) => (
          <span
            className="font-mono text-sm whitespace-nowrap"
            style={levelIndent(row.original.level)}
          >
            {row.original.code}
          </span>
        ),
      },
      {
        id: 'name',
        header: t('accounting.accounts.name'),
        cell: ({ row }) => (
          <span className="flex flex-wrap items-center gap-2">
            <span className={row.original.level === 0 ? 'font-medium' : undefined}>
              {row.original.name}
            </span>
            {row.original.isSystem && (
              <ToneBadge tone="neutral">{t('accounting.accounts.system')}</ToneBadge>
            )}
          </span>
        ),
      },
      {
        id: 'type',
        header: t('accounting.accounts.type'),
        cell: ({ row }) => <AccountTypeBadge type={row.original.type} />,
      },
      {
        id: 'debit',
        header: t('accounting.debit'),
        cell: ({ row }) => <AmountCell value={row.original.debit} currency={currency} />,
      },
      {
        id: 'credit',
        header: t('accounting.credit'),
        cell: ({ row }) => <AmountCell value={row.original.credit} currency={currency} />,
      },
      {
        id: 'balance',
        header: t('accounting.balance'),
        cell: ({ row }) => <BalanceCell value={row.original.balance} currency={currency} />,
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) =>
          canUpdate && (
            <span className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              {row.original.isActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={t('accounting.accounts.addSub')}
                  title={t('accounting.accounts.addSub')}
                  onClick={() => setDialog({ kind: 'create', parent: row.original })}
                >
                  <Plus />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.edit')}
                onClick={() => setDialog({ kind: 'edit', account: row.original })}
              >
                <Pencil />
              </Button>
              {!row.original.isSystem && !row.original.childCount && !row.original.hasEntries && (
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
                          toast.success(t('accounting.accounts.deleted'));
                          await invalidate();
                        },
                      },
                    )
                  }
                />
              )}
            </span>
          ),
      },
    ],
    [t, currency, canUpdate, remove, invalidate],
  );

  const handleExport = (format: ExportFormat) =>
    exportTable(
      format,
      'chart-of-accounts',
      [
        { header: t('accounting.accounts.code'), value: (r) => r.code },
        { header: t('accounting.accounts.name'), value: (r) => r.name },
        { header: t('accounting.accounts.type'), value: (r) => t(`accounting.type.${r.type}`) },
        { header: t('accounting.debit'), value: (r) => Number(r.debit) },
        { header: t('accounting.credit'), value: (r) => Number(r.credit) },
        { header: t('accounting.balance'), value: (r) => Number(r.balance) },
        {
          header: t('common.status'),
          value: (r) => (r.isActive ? t('common.active') : t('common.inactive')),
        },
      ],
      rows,
    );

  const installChart = () =>
    install.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('accounting.accounts.installed', { count: result.created }));
        await invalidate();
      },
    });

  const parent = dialog?.kind === 'create' ? dialog.parent : undefined;

  return (
    <>
      <PageHeader
        title={t('accounting.accounts.title')}
        description={t('accounting.accounts.subtitle')}
        actions={
          <Can permission="accounting:update">
            <Button variant="outline" onClick={installChart} disabled={install.isPending}>
              {install.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {t('accounting.accounts.install')}
            </Button>
            <Button onClick={() => setDialog({ kind: 'create' })}>
              <Plus /> {t('accounting.accounts.new')}
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchable={false}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/accounting/accounts/$id', params: { id: row.id } })
        }
        toolbar={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('accounting.accounts.searchPlaceholder')}
              aria-label={t('common.search')}
              className="w-64"
            />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-40" aria-label={t('accounting.accounts.type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('accounting.accounts.allTypes')}</SelectItem>
                {Object.values(LedgerAccountType).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`accounting.type.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={view} onValueChange={(value) => setView(value as View)}>
              <SelectTrigger className="w-44" aria-label={t('accounting.accounts.view')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VIEWS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`accounting.accounts.views.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      <SimpleFormDialog<CreateValues>
        open={dialog?.kind === 'create'}
        onOpenChange={(open) => !open && setDialog(null)}
        title={
          parent
            ? t('accounting.accounts.addSubTitle', { code: parent.code, name: parent.name })
            : t('accounting.accounts.new')
        }
        description={
          <p className="text-muted-foreground text-sm">
            {parent ? t('accounting.accounts.addSubHint') : t('accounting.accounts.newHint')}
          </p>
        }
        schema={createSchema}
        fields={[
          { name: 'code', label: t('accounting.accounts.code') },
          { name: 'name', label: t('accounting.accounts.name') },
        ]}
        defaultValues={{
          code: parent
            ? nextChildCode(
                parent.code,
                (accounts ?? []).map((a) => a.code),
              )
            : '',
          name: '',
        }}
        pending={create.isPending}
        onSubmit={(values) =>
          create.mutate(
            { data: { code: values.code.trim(), name: values.name.trim() } },
            {
              onSuccess: async (saved) => {
                toast.success(t('accounting.accounts.created', { code: saved.code }));
                setDialog(null);
                await invalidate();
              },
            },
          )
        }
      />

      {dialog?.kind === 'edit' && (
        <SimpleFormDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={t('accounting.accounts.editTitle', { code: dialog.account.code })}
          description={
            dialog.account.isSystem ? (
              <p className="text-muted-foreground text-sm">{t('accounting.accounts.systemHint')}</p>
            ) : undefined
          }
          schema={editSchema}
          fields={[
            { name: 'name', label: t('accounting.accounts.name'), wide: true },
            {
              name: 'isActive',
              label: t('common.active'),
              type: 'switch',
              disabled: dialog.account.isSystem,
            },
          ]}
          defaultValues={{ name: dialog.account.name, isActive: dialog.account.isActive }}
          pending={update.isPending}
          onSubmit={(values) =>
            update.mutate(
              {
                id: dialog.account.id,
                data: { name: values.name.trim(), isActive: values.isActive },
              },
              {
                onSuccess: async () => {
                  toast.success(t('common.saved'));
                  setDialog(null);
                  await invalidate();
                },
              },
            )
          }
        />
      )}
    </>
  );
}
