import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SettingsPage } from '@/features/settings/settings-page';

export const Route = createFileRoute('/_app/settings')({
  beforeLoad: requirePermission('settings:read'),
  component: SettingsPage,
});
