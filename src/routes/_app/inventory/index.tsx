import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { StockLevelsPage } from '@/features/inventory/stock-levels-page';

export const Route = createFileRoute('/_app/inventory/')({
  beforeLoad: requirePermission('inventory:read'),
  component: StockLevelsPage,
});
