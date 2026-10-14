import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { EInvoicesPage } from '@/features/einvoice/einvoices-page';

const searchSchema = z.object({
  direction: z.enum(['OUTGOING', 'INCOMING']).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/e-invoices/')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('einvoice:read'),
  component: function EInvoicesRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <EInvoicesPage
        direction={search.direction ?? 'OUTGOING'}
        onDirection={(direction) => void navigate({ search: { direction }, replace: true })}
      />
    );
  },
});
