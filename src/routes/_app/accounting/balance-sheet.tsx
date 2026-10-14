import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { BalanceSheetPage } from '@/features/accounting/balance-sheet-page';
import { requirePermission } from '@/features/auth/session';
import { today } from '@/features/trade/trade-components';

const searchSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/_app/accounting/balance-sheet')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('accounting:read'),
  component: function BalanceSheetRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <BalanceSheetPage
        date={search.date ?? today()}
        onDate={(date) => void navigate({ search: { date }, replace: true })}
      />
    );
  },
});
