import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { RequirementsPage } from '@/features/production/requirements-page';

export const Route = createFileRoute('/_app/production/requirements')({
  beforeLoad: requirePermission('production:read'),
  component: RequirementsPage,
});
