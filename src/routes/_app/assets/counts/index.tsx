import { createFileRoute } from '@tanstack/react-router';
import { AssetCountsPage } from '@/features/assets/asset-counts-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/assets/counts/')({
  beforeLoad: requirePermission('assets:read'),
  component: AssetCountsPage,
});
