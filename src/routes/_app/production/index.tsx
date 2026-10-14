import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { WorkOrdersPage } from '@/features/production/work-orders-page';

export const Route = createFileRoute('/_app/production/')({
  beforeLoad: requirePermission('production:read'),
  component: WorkOrdersPage,
});
