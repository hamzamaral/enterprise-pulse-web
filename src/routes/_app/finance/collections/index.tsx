import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PaymentsPage } from '@/features/finance/payments-page';

export const Route = createFileRoute('/_app/finance/collections/')({
  beforeLoad: requirePermission('finance:read'),
  component: function CollectionsRoute() {
    return <PaymentsPage direction="IN" />;
  },
});
