import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { partnersFindAll, usePartnersFindAll } from '@/api/generated/endpoints/partners/partners';
import { PartnerType, type PartnerDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { BalanceText, PartnerTypeBadge } from './partner-components';
import { PartnerFormDialog } from './partner-form-dialog';

const ALL = 'all';

export function PartnersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'code', desc: false }] });
  const [type, setType] = useState(ALL);
  const [creating, setCreating] = useState(false);

  const params = { ...table.params, type: type === ALL ? undefined : (type as PartnerType) };
  const { data, isLoading } = usePartnersFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<PartnerDto, unknown>[]>(
    () => [
      {
        id: 'code',
        header: t('common.code'),
        cell: ({ row }) => <code className="text-xs">{row.original.code}</code>,
      },
      {
        id: 'title',
        header: t('partners.titleField'),
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.title}</div>
            {row.original.taxNumber && (
              <div className="text-muted-foreground text-xs">
                {t('partners.taxNumber')}: {row.original.taxNumber}
              </div>
            )}
          </div>
        ),
      },
      {
        id: 'type',
        header: t('partners.type'),
        enableSorting: false,
        cell: ({ row }) => <PartnerTypeBadge type={row.original.type} />,
      },
      {
        id: 'city',
        header: t('common.city'),
        enableSorting: false,
        cell: ({ row }) => row.original.city ?? '—',
      },
      {
        id: 'terms',
        header: t('partners.paymentTermDays'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">
            {t('partners.days', { count: row.original.paymentTermDays })} ·{' '}
            {row.original.currencyCode}
          </span>
        ),
      },
      {
        id: 'creditLimit',
        header: t('partners.creditLimit'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.creditLimit)}</span>
        ),
      },
      {
        id: 'balance',
        header: t('partners.balance'),
        enableSorting: false,
        cell: ({ row }) => <BalanceText value={row.original.balance} />,
      },
      {
        id: 'isActive',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ActiveBadge active={row.original.isActive} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) => partnersFindAll({ ...params, page, pageSize: 100 }));
    await exportToExcel(
      'partners',
      [
        { header: t('common.code'), value: (p) => p.code },
        { header: t('partners.titleField'), value: (p) => p.title },
        { header: t('partners.type'), value: (p) => t(`partners.types.${p.type}`) },
        { header: t('partners.taxNumber'), value: (p) => p.taxNumber },
        { header: t('partners.taxOffice'), value: (p) => p.taxOffice },
        { header: t('common.city'), value: (p) => p.city },
        { header: t('common.phone'), value: (p) => p.phone },
        { header: t('common.email'), value: (p) => p.email },
        { header: t('partners.paymentTermDays'), value: (p) => p.paymentTermDays },
        { header: t('partners.currency'), value: (p) => p.currencyCode },
        {
          header: t('partners.creditLimit'),
          value: (p) => (p.creditLimit === null ? null : Number(p.creditLimit)),
        },
        { header: t('partners.balance'), value: (p) => Number(p.balance) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('partners.title')}
        description={t('partners.subtitle')}
        actions={
          <Can permission="partners:create">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('partners.new')}
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
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/partners/$id', params: { id: row.id } })}
        toolbar={
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('partners.allTypes')}</SelectItem>
              {Object.values(PartnerType).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`partners.types.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <PartnerFormDialog open={creating} onOpenChange={setCreating} partner={null} />
    </>
  );
}
