import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { FleetPage } from '@/features/fleet/fleet-page';

export const Route = createFileRoute('/_app/fleet/')({
  beforeLoad: requirePermission('fleet:read'),
  component: FleetPage,
});
