import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { InventorySettingsPage } from '@/features/inventory/inventory-settings-page';

export const Route = createFileRoute('/_app/inventory/settings')({
  beforeLoad: requirePermission('inventory:update'),
  component: InventorySettingsPage,
});
