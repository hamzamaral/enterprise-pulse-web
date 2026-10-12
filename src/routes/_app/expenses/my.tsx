import { createFileRoute } from '@tanstack/react-router';
import { MyExpensesPage } from '@/features/expenses/my-expenses-page';

export const Route = createFileRoute('/_app/expenses/my')({
  component: MyExpensesPage,
});
