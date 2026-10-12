import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PaymentDetailPage } from '@/features/finance/payment-detail-page';

export const Route = createFileRoute('/_app/finance/collections/$id')({
  beforeLoad: requirePermission('finance:read'),
  component: function CollectionDetailRoute() {
    const { id } = Route.useParams();
    return <PaymentDetailPage id={id} direction="IN" />;
  },
});
