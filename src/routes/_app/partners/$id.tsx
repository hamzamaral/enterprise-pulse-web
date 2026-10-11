import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PartnerDetailPage } from '@/features/partners/partner-detail-page';

export const Route = createFileRoute('/_app/partners/$id')({
  beforeLoad: requirePermission('partners:read'),
  component: function PartnerDetailRoute() {
    const { id } = Route.useParams();
    return <PartnerDetailPage id={id} />;
  },
});
