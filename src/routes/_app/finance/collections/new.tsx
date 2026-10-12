import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { PaymentFormPage } from '@/features/finance/payment-form-page';

const searchSchema = z.object({
  partnerId: z.string().uuid().optional().catch(undefined),
  invoiceId: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/finance/collections/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('finance:create'),
  component: function NewCollectionRoute() {
    const { partnerId, invoiceId } = Route.useSearch();
    return <PaymentFormPage direction="IN" partnerId={partnerId} invoiceId={invoiceId} />;
  },
});
