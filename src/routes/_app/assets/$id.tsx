import { createFileRoute } from '@tanstack/react-router';
import { AssetDetailPage } from '@/features/assets/asset-detail-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/assets/$id')({
  beforeLoad: requirePermission('assets:read'),
  component: function AssetDetailRoute() {
    const { id } = Route.useParams();
    return <AssetDetailPage id={id} />;
  },
});
