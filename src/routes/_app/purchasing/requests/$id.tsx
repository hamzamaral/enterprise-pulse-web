import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { RequestDetailPage } from '@/features/purchasing/request-detail-page';

export const Route = createFileRoute('/_app/purchasing/requests/$id')({
  beforeLoad: requirePermission(['workflow:start', 'purchasing:create', 'purchasing:read']),
  component: function RequestDetailRoute() {
    const { id } = Route.useParams();
    return <RequestDetailPage id={id} />;
  },
});
