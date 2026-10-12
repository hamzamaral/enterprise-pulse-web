import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { PaymentFormPage } from '@/features/finance/payment-form-page';

const searchSchema = z.object({ partnerId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/finance/payments/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('finance:create'),
  component: function NewPaymentRoute() {
    const { partnerId } = Route.useSearch();
    return <PaymentFormPage direction="OUT" partnerId={partnerId} />;
  },
});
