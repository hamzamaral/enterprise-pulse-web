import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TimesheetPage } from '@/features/hr/timesheet-page';

export const Route = createFileRoute('/_app/hr/timesheet')({
  beforeLoad: requirePermission('attendance:read'),
  component: TimesheetPage,
});
