import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { OrderDetailPage } from '@/features/purchasing/order-detail-page';

export const Route = createFileRoute('/_app/purchasing/orders/$id')({
  beforeLoad: requirePermission('purchasing:read'),
  component: function OrderDetailRoute() {
    const { id } = Route.useParams();
    return <OrderDetailPage id={id} />;
  },
});
