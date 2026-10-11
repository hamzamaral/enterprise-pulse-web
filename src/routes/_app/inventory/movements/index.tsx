import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { MovementsPage } from '@/features/inventory/movements-page';

export const Route = createFileRoute('/_app/inventory/movements/')({
  beforeLoad: requirePermission('inventory:read'),
  component: MovementsPage,
});
