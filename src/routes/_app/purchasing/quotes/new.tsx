import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { QuoteFormPage } from '@/features/purchasing/quote-form-page';

const searchSchema = z.object({ requestId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/purchasing/quotes/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('purchasing:create'),
  component: function QuoteFormRoute() {
    const { requestId } = Route.useSearch();
    return <QuoteFormPage requestId={requestId} />;
  },
});
