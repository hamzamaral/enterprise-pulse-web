import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ProductsPage } from '@/features/inventory/products-page';

export const Route = createFileRoute('/_app/inventory/products/')({
  beforeLoad: requirePermission('inventory:read'),
  component: ProductsPage,
});
