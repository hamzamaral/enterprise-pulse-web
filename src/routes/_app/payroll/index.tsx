import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PayrollPeriodsPage } from '@/features/payroll/payroll-periods-page';

export const Route = createFileRoute('/_app/payroll/')({
  beforeLoad: requirePermission('payroll:read'),
  component: PayrollPeriodsPage,
});
