import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { salariesCurrent, useSalariesCurrent } from '@/api/generated/endpoints/payroll/payroll';
import type { EmployeeSalaryDto } from '@/api/generated/model';
import { useDepartmentOptions } from '@/features/hr/hr-components';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { SalaryHistory } from './salary-history';

const ALL = '__all__';

export function SalariesPage() {
  const { t } = useTranslation();
  const currency = useBaseCurrency();
  const table = useTableState();
  const [departmentId, setDepartmentId] = useState<string>();
  const [selected, setSelected] = useState<EmployeeSalaryDto | null>(null);
  const departments = useDepartmentOptions();
  const { data, isLoading } = useSalariesCurrent(
    { ...table.params, departmentId },
    { query: tableQuery },
  );

  const columns = useMemo<ColumnDef<EmployeeSalaryDto, unknown>[]>(
    () => [
      {
        id: 'employee',
        header: t('payroll.employee'),
        enableSorting: false,
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.employeeName}</span>
            <code className="text-muted-foreground block text-xs">{row.original.employeeNo}</code>
          </span>
        ),
      },
      {
        id: 'department',
        header: t('payroll.department'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.departmentName ?? '—'}
            <span className="text-muted-foreground block text-xs">{row.original.positionName}</span>
          </span>
        ),
      },
      {
        id: 'hireDate',
        header: t('payroll.hireDate'),
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.hireDate),
      },
      {
        id: 'grossSalary',
        header: t('payroll.salaries.gross'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.grossSalary === null ? (
            <ToneBadge tone="warning">{t('payroll.salaries.missing')}</ToneBadge>
          ) : (
            <span className="font-medium tabular-nums">
              {formatMoney(row.original.grossSalary, currency)}
            </span>
          ),
      },
      {
        id: 'effectiveFrom',
        header: t('payroll.salaries.effectiveFrom'),
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.effectiveFrom),
      },
      {
        id: 'upcoming',
        header: t('payroll.salaries.upcoming'),
        enableSorting: false,
        cell: ({ row }) =>
          row.original.upcomingSalary ? (
            <span className="text-sm">
              <span className="tabular-nums">
                {formatMoney(row.original.upcomingSalary, currency)}
              </span>
              <span className="text-muted-foreground block text-xs">
                {formatDate(row.original.upcomingFrom)}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [t, currency],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      salariesCurrent({ page, pageSize: 100, departmentId, search: table.params.search }),
    );
    await exportTable(
      format,
      'salaries',
      [
        { header: t('payroll.employeeNo'), value: (r) => r.employeeNo },
        { header: t('payroll.employee'), value: (r) => r.employeeName },
        { header: t('payroll.department'), value: (r) => r.departmentName },
        { header: t('payroll.position'), value: (r) => r.positionName },
        { header: t('payroll.hireDate'), value: (r) => new Date(r.hireDate) },
        {
          header: t('payroll.salaries.gross'),
          value: (r) => (r.grossSalary === null ? null : Number(r.grossSalary)),
        },
        {
          header: t('payroll.salaries.effectiveFrom'),
          value: (r) => (r.effectiveFrom ? new Date(r.effectiveFrom) : null),
        },
        {
          header: t('payroll.salaries.upcoming'),
          value: (r) => (r.upcomingSalary === null ? null : Number(r.upcomingSalary)),
        },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('payroll.salaries.title')}
        description={t('payroll.salaries.subtitle')}
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={setSelected}
        toolbar={
          <Select
            value={departmentId ?? ALL}
            onValueChange={(value) => {
              setDepartmentId(value === ALL ? undefined : value);
              table.setPagination((p) => ({ ...p, pageIndex: 0 }));
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('payroll.allDepartments')}</SelectItem>
              {departments.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selected?.employeeName}</DialogTitle>
            <DialogDescription>{t('payroll.salaries.historyHint')}</DialogDescription>
          </DialogHeader>
          {selected && <SalaryHistory employeeId={selected.employeeId} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
