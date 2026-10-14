import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { WorkOrderPage } from '@/features/production/work-order-page';

export const Route = createFileRoute('/_app/production/work-orders/$id')({
  beforeLoad: requirePermission('production:read'),
  component: function WorkOrderRoute() {
    const { id } = Route.useParams();
    return <WorkOrderPage key={id} id={id} />;
  },
});
