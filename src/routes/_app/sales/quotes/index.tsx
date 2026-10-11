import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesQuotesPage } from '@/features/sales/quotes-page';

export const Route = createFileRoute('/_app/sales/quotes/')({
  beforeLoad: requirePermission('sales:read'),
  component: SalesQuotesPage,
});
