import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { TradeReportGroupBy } from '@/api/generated/model';
import { requirePermission } from '@/features/auth/session';
import { presetRange } from '@/features/reports/date-ranges';
import { TradeReportPage } from '@/features/reports/trade-report-page';

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
  groupBy: z.nativeEnum(TradeReportGroupBy).optional().catch(undefined),
  partnerId: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/reports/purchases')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('purchasing:read'),
  component: function PurchaseReportRoute() {
    const search = Route.useSearch();
    const navigate = Route.useNavigate();
    const range =
      search.from && search.to ? { from: search.from, to: search.to } : presetRange('thisYear');
    return (
      <TradeReportPage
        side="purchases"
        search={{ ...search, ...range, groupBy: search.groupBy ?? 'MONTH' }}
        onSearch={(patch) =>
          void navigate({ search: (prev) => ({ ...prev, ...range, ...patch }), replace: true })
        }
      />
    );
  },
});
