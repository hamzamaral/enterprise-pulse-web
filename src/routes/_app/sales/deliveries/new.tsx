import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { DeliveryFormPage } from '@/features/sales/delivery-form-page';

const searchSchema = z.object({ orderId: z.string().uuid().optional().catch(undefined) });

export const Route = createFileRoute('/_app/sales/deliveries/new')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('sales:deliver'),
  component: function DeliveryFormRoute() {
    const { orderId } = Route.useSearch();
    return <DeliveryFormPage orderId={orderId} />;
  },
});
