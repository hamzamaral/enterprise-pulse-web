import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BomFormPage } from '@/features/production/bom-form-page';

export const Route = createFileRoute('/_app/production/boms/edit/$id')({
  beforeLoad: requirePermission('production:update'),
  component: function EditBomRoute() {
    const { id } = Route.useParams();
    return <BomFormPage key={id} id={id} />;
  },
});
