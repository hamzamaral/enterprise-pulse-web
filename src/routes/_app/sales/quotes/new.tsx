import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SalesQuoteFormPage } from '@/features/sales/quote-form-page';

export const Route = createFileRoute('/_app/sales/quotes/new')({
  beforeLoad: requirePermission('sales:create'),
  component: function SalesQuoteFormRoute() {
    return <SalesQuoteFormPage />;
  },
});
