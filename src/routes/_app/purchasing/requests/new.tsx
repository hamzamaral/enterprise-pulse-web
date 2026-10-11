import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { RequestFormPage } from '@/features/purchasing/request-form-page';

export const Route = createFileRoute('/_app/purchasing/requests/new')({
  beforeLoad: requirePermission(['workflow:start', 'purchasing:create']),
  component: RequestFormPage,
});
