import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { paymentsFindAll, usePaymentsFindAll } from '@/api/generated/endpoints/finance/finance';
import {
  PaymentMethod,
  PaymentRecordStatus,
  type PaymentDirection,
  type PaymentDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { paymentBase, RecordStatusBadge } from './finance-components';

const ALL = 'ALL';

export function PaymentsPage({ direction }: { direction: PaymentDirection }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const incoming = direction === 'IN';
  const table = useTableState({ sort: [{ id: 'paymentDate', desc: true }] });
  const [method, setMethod] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const params = {
    ...table.params,
    direction,
    method: method === ALL ? undefined : (method as PaymentMethod),
    status: status === ALL ? undefined : (status as PaymentRecordStatus),
  };
  const { data, isLoading } = usePaymentsFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<PaymentDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'paymentDate',
        header: t('finance.payments.date'),
        cell: ({ row }) => formatDate(row.original.paymentDate),
      },
      {
        id: 'partner',
        header: incoming ? t('finance.payments.customer') : t('finance.payments.supplier'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'method',
        header: t('finance.payments.method'),
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            {t(`finance.methods.${row.original.method}`)}
            <div className="text-muted-foreground text-xs">
              {row.original.accountName ?? row.original.chequeNumber}
            </div>
          </div>
        ),
      },
      {
        id: 'amount',
        header: t('finance.payments.amount'),
        cell: ({ row }) => (
          <span
            className={cn(
              'font-medium tabular-nums',
              row.original.status === 'CANCELLED' && 'text-muted-foreground line-through',
            )}
          >
            {formatMoney(row.original.amount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'allocated',
        header: t('finance.payments.allocated'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatMoney(row.original.allocatedAmount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <RecordStatusBadge status={row.original.status} />,
      },
    ],
    [t, incoming],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) => paymentsFindAll({ ...params, page, pageSize: 100 }));
    await exportToExcel(
      incoming ? 'collections' : 'payments',
      [
        { header: t('trade.number'), value: (p) => p.number },
        { header: t('finance.payments.date'), value: (p) => new Date(p.paymentDate) },
        { header: t('trade.partner'), value: (p) => p.partnerTitle },
        { header: t('finance.payments.method'), value: (p) => t(`finance.methods.${p.method}`) },
        { header: t('finance.payments.account'), value: (p) => p.accountName },
        { header: t('finance.payments.cheque'), value: (p) => p.chequeNumber },
        { header: t('trade.currency'), value: (p) => p.currencyCode },
        { header: t('finance.payments.amount'), value: (p) => Number(p.amount) },
        { header: t('trade.grandTotalBase'), value: (p) => Number(p.amountBase) },
        { header: t('finance.payments.allocated'), value: (p) => Number(p.allocatedAmount) },
        { header: t('common.description'), value: (p) => p.description },
        { header: t('common.status'), value: (p) => t(`finance.recordStatus.${p.status}`) },
      ],
      rows,
    );
  };

  const base = paymentBase(direction);
  return (
    <>
      <PageHeader
        title={
          incoming ? t('finance.payments.collectionsTitle') : t('finance.payments.paymentsTitle')
        }
        description={
          incoming
            ? t('finance.payments.collectionsSubtitle')
            : t('finance.payments.paymentsSubtitle')
        }
        actions={
          <Can permission="finance:create">
            <Button asChild>
              <Link to={`${base}/new`}>
                <Plus />{' '}
                {incoming ? t('finance.payments.newCollection') : t('finance.payments.newPayment')}
              </Link>
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
        onRowClick={(row) => void navigate({ to: `${base}/$id`, params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={method}
              onValueChange={(value) => {
                setMethod(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('finance.payments.allMethods')}</SelectItem>
                {Object.values(PaymentMethod).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`finance.methods.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
                {Object.values(PaymentRecordStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`finance.recordStatus.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </>
  );
}
