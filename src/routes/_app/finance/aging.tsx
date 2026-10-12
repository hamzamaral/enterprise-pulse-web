import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { AgingPage } from '@/features/finance/aging-page';

export const Route = createFileRoute('/_app/finance/aging')({
  beforeLoad: requirePermission('finance:read'),
  component: AgingPage,
});
