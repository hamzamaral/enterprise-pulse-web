import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { LeaveSettingsPage } from '@/features/hr/leave-settings-page';

export const Route = createFileRoute('/_app/hr/leave-settings')({
  beforeLoad: requirePermission('leave:update'),
  component: LeaveSettingsPage,
});
