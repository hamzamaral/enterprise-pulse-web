import { createFileRoute } from '@tanstack/react-router';
import { JournalPage } from '@/features/accounting/journal-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/accounting/journal/')({
  beforeLoad: requirePermission('accounting:read'),
  component: JournalPage,
});
