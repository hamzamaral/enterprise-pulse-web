import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TicketsPage } from '@/features/support/tickets-page';

export const Route = createFileRoute('/_app/support/')({
  beforeLoad: requirePermission('support:read'),
  component: TicketsPage,
});
