import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ExpenseSettingsPage } from '@/features/expenses/expense-settings-page';

export const Route = createFileRoute('/_app/expenses/settings')({
  beforeLoad: requirePermission('expenses:update'),
  component: ExpenseSettingsPage,
});
