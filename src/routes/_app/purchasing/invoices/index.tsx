import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { InvoicesPage } from '@/features/purchasing/invoices-page';

export const Route = createFileRoute('/_app/purchasing/invoices/')({
  beforeLoad: requirePermission(['purchasing:read', 'finance:read']),
  component: InvoicesPage,
});
