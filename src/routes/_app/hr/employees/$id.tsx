import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { EmployeeDetailPage } from '@/features/hr/employee-detail-page';

export const Route = createFileRoute('/_app/hr/employees/$id')({
  beforeLoad: requirePermission('employees:read'),
  component: function EmployeeDetailRoute() {
    const { id } = Route.useParams();
    return <EmployeeDetailPage id={id} />;
  },
});
