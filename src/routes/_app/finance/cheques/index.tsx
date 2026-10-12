import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ChequesPage } from '@/features/finance/cheques-page';

export const Route = createFileRoute('/_app/finance/cheques/')({
  beforeLoad: requirePermission('finance:read'),
  component: ChequesPage,
});
