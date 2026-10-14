import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BomsPage } from '@/features/production/boms-page';

export const Route = createFileRoute('/_app/production/boms/')({
  beforeLoad: requirePermission('production:read'),
  component: BomsPage,
});
