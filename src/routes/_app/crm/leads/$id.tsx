import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { LeadDetailPage } from '@/features/crm/lead-detail-page';

export const Route = createFileRoute('/_app/crm/leads/$id')({
  beforeLoad: requirePermission('crm:read'),
  component: function LeadDetailRoute() {
    const { id } = Route.useParams();
    return <LeadDetailPage id={id} />;
  },
});
