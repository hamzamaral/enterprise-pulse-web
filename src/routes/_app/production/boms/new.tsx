import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BomFormPage } from '@/features/production/bom-form-page';

export const Route = createFileRoute('/_app/production/boms/new')({
  beforeLoad: requirePermission('production:update'),
  component: () => <BomFormPage />,
});
