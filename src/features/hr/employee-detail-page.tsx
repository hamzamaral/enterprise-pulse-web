import { Link, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, Pencil, Trash2, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAssetAssignmentsFindAll } from '@/api/generated/endpoints/assets/assets';
import {
  getEmployeesFindAllQueryKey,
  getEmployeesFindOneQueryKey,
  useEmployeesFindOne,
  useEmployeesRemove,
  useEmployeesTerminate,
} from '@/api/generated/endpoints/employees/employees';
import {
  useLeaveBalancesFindAll,
  useLeaveRequestsFindAll,
} from '@/api/generated/endpoints/leave/leave';
import type { EmployeeDetailDto } from '@/api/generated/model';
import { AssignmentsTable } from '@/features/assets/assignments-table';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { Field, InfoCard } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { formatDate, initials } from '@/shared/lib/format';
import { tableQuery, useInvalidate } from '@/shared/lib/query';
import { v } from '@/shared/lib/validation';
import { Avatar, AvatarFallback } from '@/shared/ui/avatar';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { RecordNotFound } from '@/shared/components/route-error';
import { EmployeeFormDialog } from './employee-form-dialog';
import { EmployeeStatusBadge } from './hr-components';
import { BalanceCards, LeaveRequestsTable } from './leave-components';

const terminateSchema = z.object({
  terminationDate: v.requiredString(),
  reason: z.string().trim().min(2, 'validation.required'),
});

function Overview({ employee }: { employee: EmployeeDetailDto }) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <InfoCard title={t('employees.employment')}>
          <Field label={t('employees.employeeNo')}>
            <code className="text-xs">{employee.employeeNo}</code>
          </Field>
          <Field label={t('employees.employmentType')}>
            {t(`employees.employmentTypes.${employee.employmentType}`)}
          </Field>
          <Field label={t('employees.department')}>{employee.departmentName}</Field>
          <Field label={t('employees.position')}>{employee.positionName}</Field>
          <Field label={t('employees.manager')}>
            {employee.managerId && (
              <Link
                to="/hr/employees/$id"
                params={{ id: employee.managerId }}
                className="text-primary hover:underline"
              >
                {employee.managerName}
              </Link>
            )}
          </Field>
          <Field label={t('employees.branch')}>{employee.branchName}</Field>
          <Field label={t('employees.hireDate')}>{formatDate(employee.hireDate)}</Field>
          <Field label={t('employees.user')}>{employee.userEmail}</Field>
          {employee.status === 'TERMINATED' && (
            <>
              <Field label={t('employees.terminationDate')}>
                {formatDate(employee.terminationDate)}
              </Field>
              <Field label={t('employees.terminationReason')}>{employee.terminationReason}</Field>
            </>
          )}
        </InfoCard>
        <InfoCard title={t('employees.personal')}>
          <Field label={t('employees.nationalId')}>{employee.nationalId}</Field>
          <Field label={t('employees.birthDate')}>
            {employee.birthDate && formatDate(employee.birthDate)}
          </Field>
          <Field label={t('employees.gender')}>
            {employee.gender && t(`employees.genders.${employee.gender}`)}
          </Field>
        </InfoCard>
        <InfoCard title={t('employees.contact')}>
          <Field label={t('common.email')}>{employee.email}</Field>
          <Field label={t('common.phone')}>{employee.phone}</Field>
          <Field label={t('employees.emergencyContactName')}>{employee.emergencyContactName}</Field>
          <Field label={t('employees.emergencyContactPhone')}>
            {employee.emergencyContactPhone}
          </Field>
          <div className="sm:col-span-2">
            <Field label={t('common.address')}>{employee.address}</Field>
          </div>
        </InfoCard>
      </div>
      <Card className="self-start">
        <CardHeader>
          <CardTitle className="text-base">
            {t('employees.reports')} ({employee.reports.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employee.reports.length ? (
            <ul className="space-y-2">
              {employee.reports.map((report) => (
                <li key={report.id}>
                  <Link
                    to="/hr/employees/$id"
                    params={{ id: report.id }}
                    className="hover:bg-muted flex items-center gap-3 rounded-md p-1.5"
                  >
                    <Avatar className="size-7">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                        {initials(report.fullName, report.fullName.split(' ').at(-1))}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{report.fullName}</span>
                    <code className="text-muted-foreground ml-auto text-xs">
                      {report.employeeNo}
                    </code>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t('employees.noReports')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeLeave({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const table = useTableState({ pageSize: 10, sort: [{ id: 'startDate', desc: true }] });
  const balances = useLeaveBalancesFindAll({ employeeId, year: new Date().getFullYear() });
  const requests = useLeaveRequestsFindAll({ ...table.params, employeeId }, { query: tableQuery });
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('leave.balances')}</h2>
        <BalanceCards balances={balances.data} isLoading={balances.isLoading} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-medium">{t('nav.leaveRequests')}</h2>
        <LeaveRequestsTable
          data={requests.data?.data}
          meta={requests.data?.meta}
          isLoading={requests.isLoading}
          state={table}
          searchable={false}
        />
      </section>
    </div>
  );
}

function EmployeeAssets({ employeeId }: { employeeId: string }) {
  const table = useTableState({ pageSize: 10, sort: [{ id: 'assignedAt', desc: true }] });
  const { data, isLoading } = useAssetAssignmentsFindAll(
    { ...table.params, employeeId },
    { query: tableQuery },
  );
  return (
    <AssignmentsTable
      data={data?.data}
      meta={data?.meta}
      isLoading={isLoading}
      state={table}
      hideAssignee
    />
  );
}

export function EmployeeDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: employee, isLoading } = useEmployeesFindOne(id);
  const [editOpen, setEditOpen] = useState(false);
  const [terminateOpen, setTerminateOpen] = useState(false);
  const terminate = useEmployeesTerminate();
  const remove = useEmployeesRemove();
  const { data: heldAssets } = useAssetAssignmentsFindAll(
    { employeeId: id, status: 'ACTIVE', pageSize: 1 },
    { query: { enabled: terminateOpen && can('assets:read') } },
  );
  const heldCount = heldAssets?.meta.total ?? 0;

  if (!employee) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <>
      <Link
        to="/hr/employees"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('employees.title')}
      </Link>
      <PageHeader
        title={employee.fullName}
        description={[employee.positionName, employee.departmentName].filter(Boolean).join(' · ')}
        actions={
          <>
            <EmployeeStatusBadge status={employee.status} />
            <Can permission="employees:update">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
              {employee.status === 'ACTIVE' && (
                <Button variant="outline" onClick={() => setTerminateOpen(true)}>
                  <UserMinus /> {t('employees.terminate')}
                </Button>
              )}
            </Can>
            <Can permission="employees:delete">
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('common.deleted'));
                        await invalidate(getEmployeesFindAllQueryKey());
                        await navigate({ to: '/hr/employees' });
                      },
                    },
                  )
                }
              />
            </Can>
          </>
        }
      />
      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">{t('employees.overview')}</TabsTrigger>
          {can('leave:read') && <TabsTrigger value="leave">{t('employees.leave')}</TabsTrigger>}
          {can('assets:read') && <TabsTrigger value="assets">{t('employees.assets')}</TabsTrigger>}
        </TabsList>
        <TabsContent value="overview">
          <Overview employee={employee} />
        </TabsContent>
        {can('leave:read') && (
          <TabsContent value="leave">
            <EmployeeLeave employeeId={employee.id} />
          </TabsContent>
        )}
        {can('assets:read') && (
          <TabsContent value="assets">
            <EmployeeAssets employeeId={employee.id} />
          </TabsContent>
        )}
      </Tabs>

      <EmployeeFormDialog open={editOpen} onOpenChange={setEditOpen} employee={employee} />
      <SimpleFormDialog<z.infer<typeof terminateSchema>>
        open={terminateOpen}
        onOpenChange={setTerminateOpen}
        title={t('employees.terminateTitle')}
        description={
          heldCount > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {t('employees.activeAssetsWarning', { count: heldCount })}
            </div>
          )
        }
        schema={terminateSchema}
        pending={terminate.isPending}
        defaultValues={{ terminationDate: new Date().toISOString().slice(0, 10), reason: '' }}
        fields={[
          { name: 'terminationDate', label: t('employees.terminationDate'), type: 'date' },
          {
            name: 'reason',
            label: t('employees.terminationReason'),
            type: 'textarea',
            wide: true,
          },
        ]}
        onSubmit={(values) =>
          terminate.mutate(
            { id, data: values },
            {
              onSuccess: async () => {
                toast.success(t('employees.terminated'));
                await invalidate(getEmployeesFindOneQueryKey(id), getEmployeesFindAllQueryKey());
                setTerminateOpen(false);
              },
            },
          )
        }
      />
    </>
  );
}
