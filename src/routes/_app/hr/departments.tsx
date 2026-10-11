import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { DepartmentsPage } from '@/features/hr/departments-page';

export const Route = createFileRoute('/_app/hr/departments')({
  beforeLoad: requirePermission('departments:read'),
  component: DepartmentsPage,
});
