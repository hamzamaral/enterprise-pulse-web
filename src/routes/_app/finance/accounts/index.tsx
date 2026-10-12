import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TreasuryAccountsPage } from '@/features/finance/accounts-page';

export const Route = createFileRoute('/_app/finance/accounts/')({
  beforeLoad: requirePermission('finance:read'),
  component: TreasuryAccountsPage,
});
