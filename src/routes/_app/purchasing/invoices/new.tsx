import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { InvoiceFormPage } from '@/features/purchasing/invoice-form-page';

const searchSchema = z.object({ orderId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/purchasing/invoices/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('purchasing:create'),
  component: function InvoiceFormRoute() {
    const { orderId } = Route.useSearch();
    return <InvoiceFormPage orderId={orderId} />;
  },
});
