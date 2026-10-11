import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { EmployeesPage } from '@/features/hr/employees-page';

export const Route = createFileRoute('/_app/hr/employees/')({
  beforeLoad: requirePermission('employees:read'),
  component: EmployeesPage,
});
