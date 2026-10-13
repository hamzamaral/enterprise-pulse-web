import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ApplicationPage } from '@/features/recruitment/application-page';

export const Route = createFileRoute('/_app/recruitment/applications/$id')({
  beforeLoad: requirePermission('recruitment:read'),
  component: function ApplicationRoute() {
    const { id } = Route.useParams();
    return <ApplicationPage id={id} />;
  },
});
