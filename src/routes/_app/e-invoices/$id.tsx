import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { EInvoiceDetailPage } from '@/features/einvoice/einvoice-detail-page';

export const Route = createFileRoute('/_app/e-invoices/$id')({
  beforeLoad: requirePermission('einvoice:read'),
  component: function EInvoiceRoute() {
    const { id } = Route.useParams();
    return <EInvoiceDetailPage key={id} id={id} />;
  },
});
