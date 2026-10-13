import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ApplicationsPage } from '@/features/recruitment/applications-page';

export const Route = createFileRoute('/_app/recruitment/applications/')({
  beforeLoad: requirePermission('recruitment:read'),
  component: ApplicationsPage,
});
