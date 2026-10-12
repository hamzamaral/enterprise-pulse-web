import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  purchaseInvoicesFindAll,
  usePurchaseInvoicesFindAll,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { InvoiceStatus, PaymentStatus, type PurchaseInvoiceDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { InvoiceStatusBadge, PaymentStatusBadge } from '@/features/trade/trade-components';

const ALL = 'ALL';

export function InvoicesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'invoiceDate', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [payment, setPayment] = useState(ALL);
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as InvoiceStatus),
    paymentStatus: payment === ALL ? undefined : (payment as PaymentStatus),
  };
  const { data, isLoading } = usePurchaseInvoicesFindAll(params, { query: tableQuery });

  const columns = useMemo<ColumnDef<PurchaseInvoiceDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'invoiceDate',
        header: t('purchasing.invoices.date'),
        cell: ({ row }) => formatDate(row.original.invoiceDate),
      },
      {
        id: 'supplierInvoiceNo',
        header: t('purchasing.invoices.supplierInvoiceNo'),
        enableSorting: false,
        cell: ({ row }) => <code className="text-xs">{row.original.supplierInvoiceNo}</code>,
      },
      {
        id: 'partner',
        header: t('purchasing.supplier'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.partnerTitle}</span>,
      },
      {
        id: 'dueDate',
        header: t('purchasing.invoices.dueDate'),
        cell: ({ row }) => (
          <span className={cn(row.original.overdue && 'text-destructive font-medium')}>
            {formatDate(row.original.dueDate)}
          </span>
        ),
      },
      {
        id: 'grandTotal',
        header: t('trade.grandTotal'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.grandTotal, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'payment',
        header: t('trade.payment'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.status === 'CANCELLED' ? (
            <InvoiceStatusBadge status={row.original.status} />
          ) : (
            <PaymentStatusBadge
              status={row.original.paymentStatus}
              overdue={row.original.overdue}
            />
          ),
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      purchaseInvoicesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'purchase-invoices',
      [
        { header: t('trade.number'), value: (i) => i.number },
        { header: t('purchasing.invoices.date'), value: (i) => new Date(i.invoiceDate) },
        { header: t('purchasing.invoices.supplierInvoiceNo'), value: (i) => i.supplierInvoiceNo },
        { header: t('purchasing.supplier'), value: (i) => i.partnerTitle },
        { header: t('purchasing.orders.single'), value: (i) => i.orderNumber },
        { header: t('purchasing.invoices.dueDate'), value: (i) => new Date(i.dueDate) },
        { header: t('trade.currency'), value: (i) => i.currencyCode },
        { header: t('trade.vatTotal'), value: (i) => Number(i.vatTotal) },
        { header: t('trade.grandTotal'), value: (i) => Number(i.grandTotal) },
        { header: t('trade.grandTotalBase'), value: (i) => Number(i.grandTotalBase) },
        { header: t('trade.paidAmount'), value: (i) => Number(i.paidAmount) },
        { header: t('common.status'), value: (i) => t(`trade.invoiceStatus.${i.status}`) },
        { header: t('trade.payment'), value: (i) => t(`trade.paymentStatus.${i.paymentStatus}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('purchasing.invoices.title')}
        description={t('purchasing.invoices.subtitle')}
        actions={
          <Can permission="purchasing:create">
            <Button asChild>
              <Link to="/purchasing/invoices/new">
                <Plus /> {t('purchasing.invoices.new')}
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
        onRowClick={(row) =>
          void navigate({ to: '/purchasing/invoices/$id', params: { id: row.id } })
        }
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
                {Object.values(InvoiceStatus)
                  .filter((value) => value !== 'DRAFT')
                  .map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`trade.invoiceStatus.${value}`)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Select
              value={payment}
              onValueChange={(value) => {
                setPayment(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('trade.allPayments')}</SelectItem>
                {Object.values(PaymentStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`trade.paymentStatus.${value}`)}
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
