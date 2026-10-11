import { createFileRoute } from '@tanstack/react-router';
import { AssetsPage } from '@/features/assets/assets-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/assets/')({
  beforeLoad: requirePermission('assets:read'),
  component: AssetsPage,
});
