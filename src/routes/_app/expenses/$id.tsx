import { createFileRoute } from '@tanstack/react-router';
import { ExpenseDetailPage } from '@/features/expenses/expense-detail-page';

export const Route = createFileRoute('/_app/expenses/$id')({
  component: function ExpenseDetailRoute() {
    const { id } = Route.useParams();
    return <ExpenseDetailPage id={id} />;
  },
});
