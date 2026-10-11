import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesOrderFormPage } from '@/features/sales/order-form-page';

export const Route = createFileRoute('/_app/sales/orders/edit/$id')({
  beforeLoad: requirePermission('sales:update'),
  component: function SalesOrderEditRoute() {
    const { id } = Route.useParams();
    return <SalesOrderFormPage orderId={id} />;
  },
});
