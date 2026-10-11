import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CountsPage } from '@/features/inventory/counts-page';

export const Route = createFileRoute('/_app/inventory/counts/')({
  beforeLoad: requirePermission('inventory:read'),
  component: CountsPage,
});
