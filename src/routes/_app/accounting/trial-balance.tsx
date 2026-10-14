import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TrialBalancePage } from '@/features/accounting/trial-balance-page';
import { requirePermission } from '@/features/auth/session';
import { presetRange } from '@/features/reports/date-ranges';

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const searchSchema = z.object({
  from: date,
  to: date,
  detailed: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/accounting/trial-balance')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('accounting:read'),
  component: function TrialBalanceRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const range =
      search.from && search.to ? { from: search.from, to: search.to } : presetRange('thisYear');
    return (
      <TrialBalancePage
        search={{ ...search, ...range }}
        onSearch={(patch) =>
          void navigate({ search: (prev) => ({ ...prev, ...range, ...patch }), replace: true })
        }
      />
    );
  },
});
