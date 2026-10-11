import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { ReceiptFormPage } from '@/features/purchasing/receipt-form-page';

const searchSchema = z.object({ orderId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/purchasing/receipts/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('purchasing:receive'),
  component: function ReceiptFormRoute() {
    const { orderId } = Route.useSearch();
    return <ReceiptFormPage orderId={orderId} />;
  },
});
