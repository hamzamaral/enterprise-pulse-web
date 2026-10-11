import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { RequestsPage } from '@/features/purchasing/requests-page';

export const Route = createFileRoute('/_app/purchasing/requests/')({
  beforeLoad: requirePermission(['workflow:start', 'purchasing:create', 'purchasing:read']),
  component: RequestsPage,
});
