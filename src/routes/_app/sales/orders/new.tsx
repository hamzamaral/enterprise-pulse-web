import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesOrderFormPage } from '@/features/sales/order-form-page';

export const Route = createFileRoute('/_app/sales/orders/new')({
  beforeLoad: requirePermission('sales:create'),
  component: function SalesOrderFormRoute() {
    return <SalesOrderFormPage />;
  },
});
