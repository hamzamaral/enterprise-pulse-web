import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { SalesInvoiceFormPage } from '@/features/sales/invoice-form-page';

const searchSchema = z.object({ orderId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/sales/invoices/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('sales:invoice'),
  component: function SalesInvoiceFormRoute() {
    const { orderId } = Route.useSearch();
    return <SalesInvoiceFormPage orderId={orderId} />;
  },
});
