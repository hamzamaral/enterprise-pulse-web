import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  employeesFindAll,
  useEmployeesFindAll,
} from '@/api/generated/endpoints/employees/employees';
import { EmployeeStatus, type EmployeeDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, initials } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { EmployeeFormDialog } from './employee-form-dialog';
import { EmployeeStatusBadge, useDepartmentOptions } from './hr-components';

const ALL = 'all';

export function EmployeesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'employeeNo', desc: false }] });
  const [departmentId, setDepartmentId] = useState(ALL);
  const [status, setStatus] = useState<string>(EmployeeStatus.ACTIVE);
  const [dialogOpen, setDialogOpen] = useState(false);
  const departmentOptions = useDepartmentOptions();

  const params = {
    ...table.params,
    departmentId: departmentId === ALL ? undefined : departmentId,
    status: status === ALL ? undefined : (status as EmployeeStatus),
  };
  const { data, isLoading } = useEmployeesFindAll(params, { query: tableQuery });

  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<EmployeeDto, unknown>[]>(
    () => [
      {
        id: 'firstName',
        header: t('employees.fullName'),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {initials(row.original.firstName, row.original.lastName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium">{row.original.fullName}</div>
              <div className="text-muted-foreground truncate text-xs">
                {row.original.email ?? row.original.phone ?? ''}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'employeeNo',
        header: t('employees.employeeNo'),
        cell: ({ row }) => <code className="text-xs">{row.original.employeeNo}</code>,
      },
      {
        id: 'department',
        header: t('employees.department'),
        enableSorting: false,
        cell: ({ row }) => (
          <div>
            <div>{row.original.departmentName ?? '—'}</div>
            <div className="text-muted-foreground text-xs">{row.original.positionName ?? ''}</div>
          </div>
        ),
      },
      {
        id: 'manager',
        header: t('employees.manager'),
        enableSorting: false,
        cell: ({ row }) => row.original.managerName ?? '—',
      },
      {
        id: 'hireDate',
        header: t('employees.hireDate'),
        cell: ({ row }) => formatDate(row.original.hireDate),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <EmployeeStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      employeesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'employees',
      [
        { header: t('employees.employeeNo'), value: (e) => e.employeeNo },
        { header: t('employees.firstName'), value: (e) => e.firstName },
        { header: t('employees.lastName'), value: (e) => e.lastName },
        { header: t('common.email'), value: (e) => e.email },
        { header: t('common.phone'), value: (e) => e.phone },
        { header: t('employees.department'), value: (e) => e.departmentName },
        { header: t('employees.position'), value: (e) => e.positionName },
        { header: t('employees.manager'), value: (e) => e.managerName },
        { header: t('employees.branch'), value: (e) => e.branchName },
        {
          header: t('employees.employmentType'),
          value: (e) => t(`employees.employmentTypes.${e.employmentType}`),
        },
        { header: t('employees.hireDate'), value: (e) => new Date(e.hireDate) },
        { header: t('common.status'), value: (e) => t(`employees.status.${e.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('employees.title')}
        description={t('employees.subtitle')}
        actions={
          <Can permission="employees:create">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('employees.new')}
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
        onRowClick={(row) => void navigate({ to: '/hr/employees/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('employees.allDepartments')}</SelectItem>
                {departmentOptions.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
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
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {Object.values(EmployeeStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`employees.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <EmployeeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={(employee) =>
          void navigate({ to: '/hr/employees/$id', params: { id: employee.id } })
        }
      />
    </>
  );
}
