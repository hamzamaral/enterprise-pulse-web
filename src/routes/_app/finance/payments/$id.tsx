import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PaymentDetailPage } from '@/features/finance/payment-detail-page';

export const Route = createFileRoute('/_app/finance/payments/$id')({
  beforeLoad: requirePermission('finance:read'),
  component: function PaymentDetailRoute() {
    const { id } = Route.useParams();
    return <PaymentDetailPage id={id} direction="OUT" />;
  },
});
