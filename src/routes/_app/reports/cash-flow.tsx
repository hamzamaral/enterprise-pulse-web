import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { CashFlowPage } from '@/features/reports/cash-flow-page';
import { presetRange } from '@/features/reports/date-ranges';

const searchSchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  accountId: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/reports/cash-flow')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('finance:read'),
  component: function CashFlowRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const range =
      search.from && search.to ? { from: search.from, to: search.to } : presetRange('thisYear');
    return (
      <CashFlowPage
        search={{ ...search, ...range }}
        onSearch={(patch) =>
          void navigate({ search: (prev) => ({ ...prev, ...range, ...patch }), replace: true })
        }
      />
    );
  },
});
