import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesOrdersPage } from '@/features/sales/orders-page';

export const Route = createFileRoute('/_app/sales/orders/')({
  beforeLoad: requirePermission('sales:read'),
  component: SalesOrdersPage,
});
