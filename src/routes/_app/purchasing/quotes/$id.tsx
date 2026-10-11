import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { QuoteDetailPage } from '@/features/purchasing/quote-detail-page';

export const Route = createFileRoute('/_app/purchasing/quotes/$id')({
  beforeLoad: requirePermission('purchasing:read'),
  component: function QuoteDetailRoute() {
    const { id } = Route.useParams();
    return <QuoteDetailPage id={id} />;
  },
});
