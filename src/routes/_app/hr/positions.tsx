import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PositionsPage } from '@/features/hr/positions-page';

export const Route = createFileRoute('/_app/hr/positions')({
  beforeLoad: requirePermission('positions:read'),
  component: PositionsPage,
});
