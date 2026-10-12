import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getTreasuryAccountsFindAllQueryKey,
  getTreasuryAccountsPositionQueryKey,
  useTreasuryAccountsCreate,
  useTreasuryAccountsFindAll,
  useTreasuryAccountsPosition,
} from '@/api/generated/endpoints/finance/finance';
import { useSettingsFindCurrencies } from '@/api/generated/endpoints/settings/settings';
import { TreasuryAccountType, type TreasuryAccountDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { today, useBaseCurrency } from '@/features/trade/trade-components';
import { AccountTypeBadge } from './finance-components';

const ALL = 'ALL';

const createSchema = z.object({
  code: v.code(),
  name: v.requiredString(),
  type: z.nativeEnum(TreasuryAccountType),
  currencyCode: v.requiredString(),
  bankName: z.string(),
  branchName: z.string(),
  iban: z.string(),
  openingBalance: z.string().refine((s) => !s.trim() || Number(s) >= 0, 'validation.number'),
  openingDate: z.string(),
});
type CreateValues = z.infer<typeof createSchema>;

function PositionCards() {
  const { t } = useTranslation();
  const base = useBaseCurrency();
  const { data } = useTreasuryAccountsPosition();
  if (!data) return <Skeleton className="h-28" />;
  const stat = (label: string, value: string, tone?: string) => (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={cn('text-lg font-semibold tabular-nums', tone)}>
        {formatMoney(value, base)}
      </div>
    </div>
  );
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{t('finance.accounts.position')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {stat(t('finance.accounts.liquidTotal'), data.totalBase)}
          {stat(
            t('finance.accounts.chequesInPortfolio'),
            data.chequesInPortfolioBase,
            'text-emerald-700 dark:text-emerald-400',
          )}
          {stat(t('finance.accounts.chequesIssued'), data.chequesIssuedBase, 'text-destructive')}
        </div>
        {data.currencies.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground text-left text-xs">
                <tr>
                  <th className="py-1 font-medium">{t('trade.currency')}</th>
                  <th className="py-1 text-right font-medium">{t('finance.accounts.cash')}</th>
                  <th className="py-1 text-right font-medium">{t('finance.accounts.bank')}</th>
                  <th className="py-1 text-right font-medium">{t('finance.accounts.total')}</th>
                  <th className="py-1 text-right font-medium">{t('finance.accounts.totalBase')}</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {data.currencies.map((row) => (
                  <tr key={row.currencyCode} className="border-t">
                    <td className="py-1.5 font-medium">{row.currencyCode}</td>
                    <td className="py-1.5 text-right">{formatMoney(row.cash, row.currencyCode)}</td>
                    <td className="py-1.5 text-right">{formatMoney(row.bank, row.currencyCode)}</td>
                    <td className="py-1.5 text-right font-medium">
                      {formatMoney(row.total, row.currencyCode)}
                    </td>
                    <td className="py-1.5 text-right">{formatMoney(row.totalBase, base)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TreasuryAccountsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const base = useBaseCurrency();
  const [type, setType] = useState(ALL);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useTreasuryAccountsFindAll({
    type: type === ALL ? undefined : (type as TreasuryAccountType),
  });
  const { data: currencies } = useSettingsFindCurrencies();
  const create = useTreasuryAccountsCreate();

  const columns = useMemo<ColumnDef<TreasuryAccountDto, unknown>[]>(
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
            {row.original.iban && (
              <code className="text-muted-foreground text-xs">{row.original.iban}</code>
            )}
          </div>
        ),
      },
      {
        id: 'type',
        header: t('finance.accounts.type'),
        cell: ({ row }) => <AccountTypeBadge type={row.original.type} />,
      },
      {
        id: 'bank',
        header: t('finance.accounts.bankName'),
        cell: ({ row }) =>
          [row.original.bankName, row.original.branchName].filter(Boolean).join(' / ') || null,
      },
      {
        id: 'balance',
        header: t('finance.accounts.balance'),
        cell: ({ row }) => (
          <span
            className={cn(
              'font-medium tabular-nums',
              Number(row.original.balance) < 0 && 'text-destructive',
            )}
          >
            {formatMoney(row.original.balance, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'balanceBase',
        header: t('finance.accounts.balanceBase'),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatMoney(row.original.balanceBase, base)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
    ],
    [t, base],
  );

  const handleExport = async () => {
    await exportToExcel(
      'treasury-accounts',
      [
        { header: t('common.code'), value: (a) => a.code },
        { header: t('common.name'), value: (a) => a.name },
        { header: t('finance.accounts.type'), value: (a) => t(`finance.accountTypes.${a.type}`) },
        { header: t('trade.currency'), value: (a) => a.currencyCode },
        { header: t('finance.accounts.bankName'), value: (a) => a.bankName },
        { header: t('finance.accounts.branchName'), value: (a) => a.branchName },
        { header: t('finance.accounts.iban'), value: (a) => a.iban },
        { header: t('finance.accounts.balance'), value: (a) => Number(a.balance) },
        { header: t('finance.accounts.balanceBase'), value: (a) => Number(a.balanceBase) },
      ],
      data ?? [],
    );
  };

  const onCreate = (values: CreateValues) =>
    create.mutate(
      {
        data: {
          code: values.code,
          name: values.name,
          type: values.type,
          currencyCode: values.currencyCode,
          bankName: values.bankName.trim() || undefined,
          branchName: values.branchName.trim() || undefined,
          iban: values.iban.trim() || undefined,
          openingBalance: values.openingBalance.trim() ? Number(values.openingBalance) : undefined,
          openingDate: values.openingDate || undefined,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('finance.accounts.created'));
          setOpen(false);
          await invalidate(
            getTreasuryAccountsFindAllQueryKey(),
            getTreasuryAccountsPositionQueryKey(),
          );
        },
      },
    );

  return (
    <>
      <PageHeader
        title={t('finance.accounts.title')}
        description={t('finance.accounts.subtitle')}
        actions={
          <Can permission="finance:update">
            <Button onClick={() => setOpen(true)}>
              <Plus /> {t('finance.accounts.new')}
            </Button>
          </Can>
        }
      />
      <PositionCards />
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/finance/accounts/$id', params: { id: row.id } })}
        toolbar={
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('finance.accounts.allTypes')}</SelectItem>
              {Object.values(TreasuryAccountType).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`finance.accountTypes.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <SimpleFormDialog<CreateValues>
        open={open}
        onOpenChange={setOpen}
        title={t('finance.accounts.new')}
        schema={createSchema}
        pending={create.isPending}
        onSubmit={onCreate}
        defaultValues={{
          code: '',
          name: '',
          type: 'BANK',
          currencyCode: base,
          bankName: '',
          branchName: '',
          iban: '',
          openingBalance: '',
          openingDate: today(),
        }}
        fields={[
          { name: 'code', label: t('common.code'), placeholder: t('finance.accounts.codeHint') },
          { name: 'name', label: t('common.name') },
          {
            name: 'type',
            label: t('finance.accounts.type'),
            type: 'select',
            required: true,
            options: Object.values(TreasuryAccountType).map((value) => ({
              value,
              label: t(`finance.accountTypes.${value}`),
            })),
          },
          {
            name: 'currencyCode',
            label: t('trade.currency'),
            type: 'select',
            required: true,
            options: (currencies ?? [])
              .filter((c) => c.isActive)
              .map((c) => ({ value: c.code, label: `${c.code} · ${c.name}` })),
          },
          { name: 'bankName', label: t('finance.accounts.bankName') },
          { name: 'branchName', label: t('finance.accounts.branchName') },
          { name: 'iban', label: t('finance.accounts.iban'), wide: true },
          { name: 'openingBalance', label: t('finance.accounts.openingBalance'), type: 'number' },
          { name: 'openingDate', label: t('finance.accounts.openingDate'), type: 'date' },
        ]}
      />
    </>
  );
}
