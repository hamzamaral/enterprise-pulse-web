import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BudgetsPage } from '@/features/budgets/budgets-page';

const searchSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/budgets/')({
  validateSearch: searchSchema,
  component: function BudgetsRoute() {
    const { year } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <BudgetsPage
        year={year ?? new Date().getFullYear()}
        onYearChange={(next) =>
          void navigate({
            search: { year: next === new Date().getFullYear() ? undefined : next },
            replace: true,
          })
        }
      />
    );
  },
});
