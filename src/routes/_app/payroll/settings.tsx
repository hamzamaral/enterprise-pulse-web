import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PayrollSettingsPage } from '@/features/payroll/payroll-settings-page';

export const Route = createFileRoute('/_app/payroll/settings')({
  beforeLoad: requirePermission('payroll:update'),
  component: PayrollSettingsPage,
});
