import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { InstancesPage } from '@/features/workflow/instances-page';

export const Route = createFileRoute('/_app/workflow/instances/')({
  beforeLoad: requirePermission('workflow:read'),
  component: InstancesPage,
});
