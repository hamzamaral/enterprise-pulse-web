import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ReceiptDetailPage } from '@/features/purchasing/receipt-detail-page';

export const Route = createFileRoute('/_app/purchasing/receipts/$id')({
  beforeLoad: requirePermission('purchasing:read'),
  component: function ReceiptDetailRoute() {
    const { id } = Route.useParams();
    return <ReceiptDetailPage id={id} />;
  },
});
