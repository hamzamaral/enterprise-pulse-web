import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalariesPage } from '@/features/payroll/salaries-page';

export const Route = createFileRoute('/_app/payroll/salaries')({
  beforeLoad: requirePermission('payroll:read'),
  component: SalariesPage,
});
