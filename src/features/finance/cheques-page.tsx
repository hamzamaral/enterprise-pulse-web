import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { chequesFindAll, useChequesFindAll } from '@/api/generated/endpoints/finance/finance';
import { ChequeDirection, ChequeKind, ChequeStatus, type ChequeDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { ChequeStatusBadge } from './finance-components';

const ALL = 'ALL';

export function ChequesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'dueDate', desc: false }] });
  const [direction, setDirection] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [openOnly, setOpenOnly] = useState(true);
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const params = {
    ...table.params,
    direction: direction === ALL ? undefined : (direction as ChequeDirection),
    kind: kind === ALL ? undefined : (kind as ChequeKind),
    status: status === ALL ? undefined : (status as ChequeStatus),
    open: openOnly || undefined,
  };
  const { data, isLoading } = useChequesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<ChequeDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => (
          <div>
            <code className="text-xs">{row.original.number}</code>
            <div className="text-muted-foreground text-xs">
              {t(`finance.chequeKinds.${row.original.kind}`)} ·{' '}
              {t(`finance.chequeDirections.${row.original.direction}`)}
            </div>
          </div>
        ),
      },
      {
        id: 'serialNo',
        header: t('finance.cheques.serialNo'),
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <code className="text-xs">{row.original.serialNo}</code>
            {row.original.bankName && (
              <div className="text-muted-foreground text-xs">{row.original.bankName}</div>
            )}
          </div>
        ),
      },
      {
        id: 'partner',
        header: t('finance.cheques.partner'),
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.partnerTitle}</span>
            {row.original.endorsedToTitle && (
              <div className="text-muted-foreground text-xs">→ {row.original.endorsedToTitle}</div>
            )}
          </div>
        ),
      },
      {
        id: 'dueDate',
        header: t('finance.cheques.dueDate'),
        cell: ({ row }) => (
          <span className={cn(row.original.overdue && 'text-destructive font-medium')}>
            {formatDate(row.original.dueDate)}
          </span>
        ),
      },
      {
        id: 'amount',
        header: t('finance.cheques.amount'),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatMoney(row.original.amount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'account',
        header: t('finance.cheques.account'),
        enableSorting: false,
        cell: ({ row }) => row.original.accountName,
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ChequeStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) => chequesFindAll({ ...params, page, pageSize: 100 }));
    await exportToExcel(
      'cheques',
      [
        { header: t('trade.number'), value: (c) => c.number },
        { header: t('finance.cheques.kind'), value: (c) => t(`finance.chequeKinds.${c.kind}`) },
        {
          header: t('finance.cheques.direction'),
          value: (c) => t(`finance.chequeDirections.${c.direction}`),
        },
        { header: t('finance.cheques.serialNo'), value: (c) => c.serialNo },
        { header: t('finance.cheques.bank'), value: (c) => c.bankName },
        { header: t('finance.cheques.drawer'), value: (c) => c.drawer },
        { header: t('finance.cheques.partner'), value: (c) => c.partnerTitle },
        { header: t('finance.cheques.endorsedTo'), value: (c) => c.endorsedToTitle },
        { header: t('finance.cheques.issueDate'), value: (c) => new Date(c.issueDate) },
        { header: t('finance.cheques.dueDate'), value: (c) => new Date(c.dueDate) },
        { header: t('trade.currency'), value: (c) => c.currencyCode },
        { header: t('finance.cheques.amount'), value: (c) => Number(c.amount) },
        { header: t('finance.cheques.account'), value: (c) => c.accountName },
        { header: t('common.status'), value: (c) => t(`finance.chequeStatus.${c.status}`) },
      ],
      rows,
    );
  };

  const filter = (
    value: string,
    onChange: (value: string) => void,
    allLabel: string,
    options: readonly string[],
    label: (value: string) => string,
    width: string,
  ) => (
    <Select
      value={value}
      onValueChange={(next) => {
        onChange(next);
        resetPage();
      }}
    >
      <SelectTrigger className={width}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {label(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <>
      <PageHeader title={t('finance.cheques.title')} description={t('finance.cheques.subtitle')} />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/finance/cheques/$id', params: { id: row.id } })}
        toolbar={
          <>
            {filter(
              direction,
              setDirection,
              t('finance.cheques.allDirections'),
              Object.values(ChequeDirection),
              (v) => t(`finance.chequeDirections.${v as ChequeDirection}`),
              'w-44',
            )}
            {filter(
              kind,
              setKind,
              t('finance.cheques.allKinds'),
              Object.values(ChequeKind),
              (v) => t(`finance.chequeKinds.${v as ChequeKind}`),
              'w-40',
            )}
            {filter(
              status,
              setStatus,
              t('trade.allStatuses'),
              Object.values(ChequeStatus),
              (v) => t(`finance.chequeStatus.${v as ChequeStatus}`),
              'w-44',
            )}
            <div className="flex items-center gap-2">
              <Switch
                id="cheques-open"
                checked={openOnly}
                onCheckedChange={(checked) => {
                  setOpenOnly(checked);
                  resetPage();
                }}
              />
              <Label htmlFor="cheques-open" className="text-sm font-normal">
                {t('finance.cheques.openOnly')}
              </Label>
            </div>
          </>
        }
      />
    </>
  );
}
