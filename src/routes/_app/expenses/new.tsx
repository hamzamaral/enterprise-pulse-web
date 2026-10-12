import { createFileRoute } from '@tanstack/react-router';
import { ExpenseFormPage } from '@/features/expenses/expense-form-page';

export const Route = createFileRoute('/_app/expenses/new')({
  component: function NewExpenseRoute() {
    return <ExpenseFormPage />;
  },
});
