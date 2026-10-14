import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { IncomeStatementPage } from '@/features/accounting/income-statement-page';
import { requirePermission } from '@/features/auth/session';
import { presetRange } from '@/features/reports/date-ranges';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const searchSchema = z.object({ from: date, to: date });

export const Route = createFileRoute('/_app/accounting/income-statement')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('accounting:read'),
  component: function IncomeStatementRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const range =
      search.from && search.to ? { from: search.from, to: search.to } : presetRange('thisYear');
    return (
      <IncomeStatementPage
        search={range}
        onSearch={(next) => void navigate({ search: next, replace: true })}
      />
    );
  },
});
