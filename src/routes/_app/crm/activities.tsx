import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ActivitiesPage } from '@/features/crm/activities-page';

export const Route = createFileRoute('/_app/crm/activities')({
  beforeLoad: requirePermission('crm:read'),
  component: ActivitiesPage,
});
