import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { JobPostingPage } from '@/features/recruitment/job-posting-page';

export const Route = createFileRoute('/_app/recruitment/$id')({
  beforeLoad: requirePermission('recruitment:read'),
  component: function JobPostingRoute() {
    const { id } = Route.useParams();
    return <JobPostingPage id={id} />;
  },
});
