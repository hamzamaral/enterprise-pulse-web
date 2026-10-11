import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { LeaveRequestsPage } from '@/features/hr/leave-requests-page';

export const Route = createFileRoute('/_app/hr/leave-requests')({
  beforeLoad: requirePermission('leave:read'),
  component: LeaveRequestsPage,
});
