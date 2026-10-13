import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayslipsMine } from '@/api/generated/endpoints/payroll/payroll';
import type { MyPayslipDto } from '@/api/generated/model';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { PayrollStatusBadge, periodLabel } from './payroll-components';

const CURRENT_YEAR = new Date().getFullYear();

export function MyPayslipsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = usePayslipsMine();
  const last = data?.[0];
  const currency = last?.currencyCode ?? 'TRY';
  const thisYear = data?.filter((slip) => slip.year === CURRENT_YEAR) ?? [];
  const sum = (key: 'grossPay' | 'netPay') =>
    thisYear.reduce((total, slip) => total + Number(slip[key]), 0);

  const columns = useMemo<ColumnDef<MyPayslipDto, unknown>[]>(
    () => [
      {
        id: 'period',
        header: t('payroll.period'),
        cell: ({ row }) => <span className="font-medium">{periodLabel(row.original)}</span>,
      },
      {
        id: 'grossPay',
        header: t('payroll.gross'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.grossPay, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'netPay',
        header: t('payroll.net'),
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatMoney(row.original.netPay, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'paymentDate',
        header: t('payroll.paymentDate'),
        cell: ({ row }) => formatDate(row.original.paymentDate),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <PayrollStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader title={t('payroll.myTitle')} description={t('payroll.mySubtitle')} />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={t('payroll.my.lastNet')}
          value={data && (last ? formatMoney(last.netPay, currency) : '—')}
          hint={last && periodLabel(last)}
        />
        <KpiCard
          label={t('payroll.my.yearGross', { year: CURRENT_YEAR })}
          value={data && formatMoney(sum('grossPay'), currency)}
          hint={data && t('payroll.my.slipCount', { count: thisYear.length })}
        />
        <KpiCard
          label={t('payroll.my.yearNet', { year: CURRENT_YEAR })}
          value={data && formatMoney(sum('netPay'), currency)}
        />
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        onRowClick={(row) => void navigate({ to: '/payroll/payslips/$id', params: { id: row.id } })}
      />
    </>
  );
}
