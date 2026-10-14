import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BomPage } from '@/features/production/bom-page';

export const Route = createFileRoute('/_app/production/boms/$id')({
  beforeLoad: requirePermission('production:read'),
  component: function BomRoute() {
    const { id } = Route.useParams();
    return <BomPage key={id} id={id} />;
  },
});
