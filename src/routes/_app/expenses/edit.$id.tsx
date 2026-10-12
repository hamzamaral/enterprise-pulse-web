import { createFileRoute } from '@tanstack/react-router';
import { ExpenseFormPage } from '@/features/expenses/expense-form-page';

export const Route = createFileRoute('/_app/expenses/edit/$id')({
  component: function EditExpenseRoute() {
    const { id } = Route.useParams();
    return <ExpenseFormPage key={id} id={id} />;
  },
});
