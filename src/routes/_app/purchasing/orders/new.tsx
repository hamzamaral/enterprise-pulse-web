import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { OrderFormPage } from '@/features/purchasing/order-form-page';

export const Route = createFileRoute('/_app/purchasing/orders/new')({
  beforeLoad: requirePermission('purchasing:create'),
  component: OrderFormPage,
});
