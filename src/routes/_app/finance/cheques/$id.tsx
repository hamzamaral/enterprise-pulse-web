import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ChequeDetailPage } from '@/features/finance/cheque-detail-page';

export const Route = createFileRoute('/_app/finance/cheques/$id')({
  beforeLoad: requirePermission('finance:read'),
  component: function ChequeDetailRoute() {
    const { id } = Route.useParams();
    return <ChequeDetailPage id={id} />;
  },
});
