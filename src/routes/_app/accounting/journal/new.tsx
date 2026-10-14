import { createFileRoute } from '@tanstack/react-router';
import { JournalFormPage } from '@/features/accounting/journal-form-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/accounting/journal/new')({
  beforeLoad: requirePermission('accounting:update'),
  component: () => <JournalFormPage />,
});
