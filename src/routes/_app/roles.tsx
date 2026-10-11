import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { RolesPage } from '@/features/roles/roles-page';

export const Route = createFileRoute('/_app/roles')({
  beforeLoad: requirePermission('roles:read'),
  component: RolesPage,
});
