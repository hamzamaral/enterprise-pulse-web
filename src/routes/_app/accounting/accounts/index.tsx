import { createFileRoute } from '@tanstack/react-router';
import { AccountsPage } from '@/features/accounting/accounts-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/accounting/accounts/')({
  beforeLoad: requirePermission('accounting:read'),
  component: AccountsPage,
});
