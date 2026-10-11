import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { StockLevelsPage } from '@/features/inventory/stock-levels-page';

const searchSchema = z.object({
  lowStock: z.boolean().optional().catch(undefined),
});

export const Route = createFileRoute('/_app/inventory/')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('inventory:read'),
  component: function StockLevelsRoute() {
    const { lowStock } = Route.useSearch();
    return <StockLevelsPage key={String(lowStock)} initialLowStock={lowStock} />;
  },
});
