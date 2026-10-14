import { createFileRoute } from '@tanstack/react-router';
import { JournalEntryPage } from '@/features/accounting/journal-entry-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/accounting/journal/$id')({
  beforeLoad: requirePermission('accounting:read'),
  component: function JournalEntryRoute() {
    const { id } = Route.useParams();
    return <JournalEntryPage key={id} id={id} />;
  },
});
