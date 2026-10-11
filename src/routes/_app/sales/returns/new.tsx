import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { SalesReturnFormPage } from '@/features/sales/return-form-page';

const searchSchema = z.object({ invoiceId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/sales/returns/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('sales:deliver'),
  component: function SalesReturnFormRoute() {
    const { invoiceId } = Route.useSearch();
    return <SalesReturnFormPage invoiceId={invoiceId} />;
  },
});
