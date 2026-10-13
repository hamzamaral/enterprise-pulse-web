import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BudgetEntriesPage } from '@/features/budgets/budget-entries-page';

export const Route = createFileRoute('/_app/budgets/entries')({
  beforeLoad: requirePermission('budgets:read'),
  component: BudgetEntriesPage,
});
