import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesInvoicesPage } from '@/features/sales/invoices-page';

export const Route = createFileRoute('/_app/sales/invoices/')({
  beforeLoad: requirePermission(['sales:read', 'finance:read']),
  component: SalesInvoicesPage,
});
