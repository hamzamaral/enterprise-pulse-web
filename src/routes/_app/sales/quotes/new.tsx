import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { SalesQuoteFormPage } from '@/features/sales/quote-form-page';

const searchSchema = z.object({
  partnerId: z.string().uuid().optional().catch(undefined),
  opportunityId: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/sales/quotes/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('sales:create'),
  component: function SalesQuoteFormRoute() {
    const { partnerId, opportunityId } = Route.useSearch();
    return <SalesQuoteFormPage partnerId={partnerId} opportunityId={opportunityId} />;
  },
});
