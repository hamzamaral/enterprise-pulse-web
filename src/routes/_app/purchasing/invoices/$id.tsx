import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { InvoiceDetailPage } from '@/features/purchasing/invoice-detail-page';

export const Route = createFileRoute('/_app/purchasing/invoices/$id')({
  beforeLoad: requirePermission(['purchasing:read', 'finance:read']),
  component: function InvoiceDetailRoute() {
    const { id } = Route.useParams();
    return <InvoiceDetailPage id={id} />;
  },
});
