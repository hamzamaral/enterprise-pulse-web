import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BranchesPage } from '@/features/organization/branches-page';

export const Route = createFileRoute('/_app/branches')({
  beforeLoad: requirePermission('branches:read'),
  component: BranchesPage,
});
