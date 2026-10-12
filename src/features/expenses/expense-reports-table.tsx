import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  expenseReportsFindAll,
  useExpenseReportsFindAll,
} from '@/api/generated/endpoints/expenses/expenses';
import { ExpenseReportStatus, type ExpenseReportDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { ExpenseStatusBadge } from './expense-components';

const ALL = 'ALL';

/** `mine` pins the list to the current user; otherwise a toggle offers it. */
export function ExpenseReportsTable({ mine: pinned }: { mine?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [onlyMine, setOnlyMine] = useState(false);
  const mine = pinned || onlyMine;

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as ExpenseReportStatus),
    mine: mine ? ('true' as const) : undefined,
  };
  const { data, isLoading } = useExpenseReportsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<ExpenseReportDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'createdAt',
        header: t('expenses.createdAt'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'title',
        header: t('expenses.titleField'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      ...(pinned
        ? []
        : [
            {
              id: 'employee',
              header: t('expenses.employee'),
              enableSorting: false,
              cell: ({ row }) => (
                <span>
                  {row.original.employeeName}
                  {row.original.departmentName && (
                    <span className="text-muted-foreground block text-xs">
                      {row.original.departmentName}
                    </span>
                  )}
                </span>
              ),
            } satisfies ColumnDef<ExpenseReportDto, unknown>,
          ]),
      {
        id: 'lineCount',
        header: t('expenses.lineCount'),
        enableSorting: false,
        cell: ({ row }) => row.original.lineCount,
      },
      {
        id: 'totalAmount',
        header: t('expenses.total'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.totalAmount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'submittedAt',
        header: t('expenses.submittedAt'),
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.submittedAt),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <ExpenseStatusBadge status={row.original.status} />,
      },
    ],
    [t, pinned],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      expenseReportsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'expense-reports',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('expenses.createdAt'), value: (r) => new Date(r.createdAt) },
        { header: t('expenses.titleField'), value: (r) => r.title },
        { header: t('expenses.employee'), value: (r) => r.employeeName },
        { header: t('expenses.department'), value: (r) => r.departmentName },
        { header: t('expenses.lineCount'), value: (r) => r.lineCount },
        { header: t('expenses.total'), value: (r) => Number(r.totalAmount) },
        {
          header: t('expenses.submittedAt'),
          value: (r) => (r.submittedAt ? new Date(r.submittedAt) : null),
        },
        {
          header: t('expenses.paymentDate'),
          value: (r) => (r.paymentDate ? new Date(r.paymentDate) : null),
        },
        { header: t('common.status'), value: (r) => t(`expenses.status.${r.status}`) },
      ],
      rows,
    );
  };

  return (
    <DataTable
      columns={columns}
      data={data?.data}
      meta={data?.meta}
      isLoading={isLoading}
      state={table}
      onExport={handleExport}
      onRowClick={(row) => void navigate({ to: '/expenses/$id', params: { id: row.id } })}
      toolbar={
        <>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
              {Object.values(ExpenseReportStatus).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`expenses.status.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!pinned && (
            <div className="flex items-center gap-2">
              <Switch
                id="expenses-mine"
                checked={onlyMine}
                onCheckedChange={(checked) => {
                  setOnlyMine(checked);
                  resetPage();
                }}
              />
              <Label htmlFor="expenses-mine" className="text-sm font-normal">
                {t('expenses.onlyMine')}
              </Label>
            </div>
          )}
        </>
      }
    />
  );
}
