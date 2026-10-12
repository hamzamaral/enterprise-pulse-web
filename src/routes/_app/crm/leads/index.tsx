import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { LeadsPage } from '@/features/crm/leads-page';

export const Route = createFileRoute('/_app/crm/leads/')({
  beforeLoad: requirePermission('crm:read'),
  component: LeadsPage,
});
