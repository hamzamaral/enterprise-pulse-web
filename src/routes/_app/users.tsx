import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { UsersPage } from '@/features/users/users-page';

export const Route = createFileRoute('/_app/users')({
  beforeLoad: requirePermission('users:read'),
  component: UsersPage,
});
