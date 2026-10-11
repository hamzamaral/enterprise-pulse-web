import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { OrderFormPage } from '@/features/purchasing/order-form-page';

export const Route = createFileRoute('/_app/purchasing/orders/edit/$id')({
  beforeLoad: requirePermission('purchasing:update'),
  component: function OrderFormRouteEdit() {
    const { id } = Route.useParams();
    return <OrderFormPage orderId={id} />;
  },
});
