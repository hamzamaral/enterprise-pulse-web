import { createFileRoute } from '@tanstack/react-router';
import { AssetCountDetailPage } from '@/features/assets/asset-count-detail-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/assets/counts/$id')({
  beforeLoad: requirePermission('assets:read'),
  component: function AssetCountDetailRoute() {
    const { id } = Route.useParams();
    return <AssetCountDetailPage id={id} />;
  },
});
