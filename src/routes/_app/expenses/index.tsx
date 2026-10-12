import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ExpensesPage } from '@/features/expenses/expenses-page';

export const Route = createFileRoute('/_app/expenses/')({
  beforeLoad: requirePermission('expenses:read'),
  component: ExpensesPage,
});
