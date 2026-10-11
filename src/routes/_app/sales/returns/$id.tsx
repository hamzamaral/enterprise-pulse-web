import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesReturnDetailPage } from '@/features/sales/return-detail-page';

export const Route = createFileRoute('/_app/sales/returns/$id')({
  beforeLoad: requirePermission(['sales:read', 'finance:read']),
  component: function SalesReturnDetailRoute() {
    const { id } = Route.useParams();
    return <SalesReturnDetailPage id={id} />;
  },
});
