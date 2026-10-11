import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesOrderDetailPage } from '@/features/sales/order-detail-page';

export const Route = createFileRoute('/_app/sales/orders/$id')({
  beforeLoad: requirePermission('sales:read'),
  component: function SalesOrderDetailRoute() {
    const { id } = Route.useParams();
    return <SalesOrderDetailPage id={id} />;
  },
});
