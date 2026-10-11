import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesReturnsPage } from '@/features/sales/returns-page';

export const Route = createFileRoute('/_app/sales/returns/')({
  beforeLoad: requirePermission(['sales:read', 'finance:read']),
  component: SalesReturnsPage,
});
