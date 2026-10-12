import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { OpportunityDetailPage } from '@/features/crm/opportunity-detail-page';

export const Route = createFileRoute('/_app/crm/opportunities/$id')({
  beforeLoad: requirePermission('crm:read'),
  component: function OpportunityDetailRoute() {
    const { id } = Route.useParams();
    return <OpportunityDetailPage id={id} />;
  },
});
