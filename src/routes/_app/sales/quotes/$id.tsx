import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesQuoteDetailPage } from '@/features/sales/quote-detail-page';

export const Route = createFileRoute('/_app/sales/quotes/$id')({
  beforeLoad: requirePermission('sales:read'),
  component: function SalesQuoteDetailRoute() {
    const { id } = Route.useParams();
    return <SalesQuoteDetailPage id={id} />;
  },
});
