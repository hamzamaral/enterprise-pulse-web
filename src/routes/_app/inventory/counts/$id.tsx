import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CountDetailPage } from '@/features/inventory/count-detail-page';

export const Route = createFileRoute('/_app/inventory/counts/$id')({
  beforeLoad: requirePermission('inventory:read'),
  component: function CountDetailRoute() {
    const { id } = Route.useParams();
    return <CountDetailPage id={id} />;
  },
});
