import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CompliancePage } from '@/features/training/compliance-page';

export const Route = createFileRoute('/_app/training/compliance')({
  beforeLoad: requirePermission('training:read'),
  component: CompliancePage,
});
