import { createFileRoute } from '@tanstack/react-router';
import { AccountingPage } from '@/features/accounting/accounting-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/accounting/')({
  beforeLoad: requirePermission('accounting:read'),
  component: AccountingPage,
});
