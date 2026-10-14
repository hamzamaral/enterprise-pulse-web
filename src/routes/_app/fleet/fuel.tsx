import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { FuelLogPage } from '@/features/fleet/fuel-log-page';

export const Route = createFileRoute('/_app/fleet/fuel')({
  beforeLoad: requirePermission('fleet:read'),
  component: FuelLogPage,
});
