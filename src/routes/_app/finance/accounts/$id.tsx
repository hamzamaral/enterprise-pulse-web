import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TreasuryAccountDetailPage } from '@/features/finance/account-detail-page';

export const Route = createFileRoute('/_app/finance/accounts/$id')({
  beforeLoad: requirePermission('finance:read'),
  component: function TreasuryAccountDetailRoute() {
    const { id } = Route.useParams();
    return <TreasuryAccountDetailPage id={id} />;
  },
});
