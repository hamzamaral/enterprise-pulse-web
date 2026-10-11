import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CompaniesPage } from '@/features/organization/companies-page';

export const Route = createFileRoute('/_app/companies')({
  beforeLoad: requirePermission('companies:read'),
  component: CompaniesPage,
});
