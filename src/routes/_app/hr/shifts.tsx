import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ShiftPlanningPage } from '@/features/hr/shift-planning-page';

export const Route = createFileRoute('/_app/hr/shifts')({
  beforeLoad: requirePermission('attendance:read'),
  component: ShiftPlanningPage,
});
