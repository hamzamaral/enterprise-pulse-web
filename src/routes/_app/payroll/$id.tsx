import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PayrollPeriodPage } from '@/features/payroll/payroll-period-page';

export const Route = createFileRoute('/_app/payroll/$id')({
  beforeLoad: requirePermission('payroll:read'),
  component: function PayrollPeriodRoute() {
    const { id } = Route.useParams();
    return <PayrollPeriodPage id={id} />;
  },
});
