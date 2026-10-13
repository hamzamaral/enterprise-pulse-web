import { createFileRoute } from '@tanstack/react-router';
import { BudgetPage } from '@/features/budgets/budget-page';

export const Route = createFileRoute('/_app/budgets/$id')({
  component: function BudgetRoute() {
    const { id } = Route.useParams();
    return <BudgetPage id={id} />;
  },
});
