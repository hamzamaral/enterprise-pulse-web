import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PaymentsPage } from '@/features/finance/payments-page';

export const Route = createFileRoute('/_app/finance/payments/')({
  beforeLoad: requirePermission('finance:read'),
  component: function PaymentsRoute() {
    return <PaymentsPage direction="OUT" />;
  },
});
