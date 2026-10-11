import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { DeliveriesPage } from '@/features/sales/deliveries-page';

export const Route = createFileRoute('/_app/sales/deliveries/')({
  beforeLoad: requirePermission('sales:read'),
  component: DeliveriesPage,
});
