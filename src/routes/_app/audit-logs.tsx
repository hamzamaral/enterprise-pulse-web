import { createFileRoute } from '@tanstack/react-router';
import { AuditLogsPage } from '@/features/audit/audit-logs-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/audit-logs')({
  beforeLoad: requirePermission('audit:read'),
  component: AuditLogsPage,
});
