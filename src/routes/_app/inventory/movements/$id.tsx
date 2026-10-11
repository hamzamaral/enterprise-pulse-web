import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { MovementDetailPage } from '@/features/inventory/movement-detail-page';

export const Route = createFileRoute('/_app/inventory/movements/$id')({
  beforeLoad: requirePermission('inventory:read'),
  component: function MovementDetailRoute() {
    const { id } = Route.useParams();
    return <MovementDetailPage id={id} />;
  },
});
