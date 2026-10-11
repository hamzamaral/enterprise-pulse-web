import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesInvoiceDetailPage } from '@/features/sales/invoice-detail-page';

export const Route = createFileRoute('/_app/sales/invoices/$id')({
  beforeLoad: requirePermission(['sales:read', 'finance:read']),
  component: function SalesInvoiceDetailRoute() {
    const { id } = Route.useParams();
    return <SalesInvoiceDetailPage id={id} />;
  },
});
