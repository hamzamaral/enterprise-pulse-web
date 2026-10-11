import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { DeliveryDetailPage } from '@/features/sales/delivery-detail-page';

export const Route = createFileRoute('/_app/sales/deliveries/$id')({
  beforeLoad: requirePermission('sales:read'),
  component: function DeliveryDetailRoute() {
    const { id } = Route.useParams();
    return <DeliveryDetailPage id={id} />;
  },
});
