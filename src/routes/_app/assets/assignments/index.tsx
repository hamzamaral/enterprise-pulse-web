import { createFileRoute } from '@tanstack/react-router';
import { AssignmentsPage } from '@/features/assets/assignments-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/assets/assignments/')({
  beforeLoad: requirePermission('assets:read'),
  component: AssignmentsPage,
});
