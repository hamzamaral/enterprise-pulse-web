import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { BudgetItemsPage } from '@/features/budgets/budget-items-page';

export const Route = createFileRoute('/_app/budgets/items')({
  beforeLoad: requirePermission('budgets:update'),
  component: BudgetItemsPage,
});
