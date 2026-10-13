import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CandidatePage } from '@/features/recruitment/candidate-page';

export const Route = createFileRoute('/_app/recruitment/candidates/$id')({
  beforeLoad: requirePermission('recruitment:read'),
  component: function CandidateRoute() {
    const { id } = Route.useParams();
    return <CandidatePage id={id} />;
  },
});
