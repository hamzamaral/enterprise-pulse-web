import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CandidatesPage } from '@/features/recruitment/candidates-page';

export const Route = createFileRoute('/_app/recruitment/candidates/')({
  beforeLoad: requirePermission('recruitment:read'),
  component: CandidatesPage,
});
