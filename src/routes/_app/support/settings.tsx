import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { SupportSettingsPage } from '@/features/support/support-settings-page';

export const Route = createFileRoute('/_app/support/settings')({
  beforeLoad: requirePermission('support:update'),
  component: SupportSettingsPage,
});
