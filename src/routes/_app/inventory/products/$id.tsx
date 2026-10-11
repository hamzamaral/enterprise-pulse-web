import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ProductDetailPage } from '@/features/inventory/product-detail-page';

export const Route = createFileRoute('/_app/inventory/products/$id')({
  beforeLoad: requirePermission('inventory:read'),
  component: function ProductDetailRoute() {
    const { id } = Route.useParams();
    return <ProductDetailPage id={id} />;
  },
});
