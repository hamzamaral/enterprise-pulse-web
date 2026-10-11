import { createFileRoute } from '@tanstack/react-router';
import { AssetSettingsPage } from '@/features/assets/asset-settings-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/assets/settings')({
  beforeLoad: requirePermission('assets:update'),
  component: AssetSettingsPage,
});
