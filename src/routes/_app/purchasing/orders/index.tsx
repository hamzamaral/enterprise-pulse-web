import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { OrdersPage } from '@/features/purchasing/orders-page';

export const Route = createFileRoute('/_app/purchasing/orders/')({
  beforeLoad: requirePermission('purchasing:read'),
  component: OrdersPage,
});
