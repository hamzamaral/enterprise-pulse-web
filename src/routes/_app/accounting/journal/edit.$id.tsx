import { createFileRoute } from '@tanstack/react-router';
import { JournalFormPage } from '@/features/accounting/journal-form-page';
import { requirePermission } from '@/features/auth/session';

export const Route = createFileRoute('/_app/accounting/journal/edit/$id')({
  beforeLoad: requirePermission('accounting:update'),
  component: function EditJournalEntryRoute() {
    const { id } = Route.useParams();
    return <JournalFormPage key={id} id={id} />;
  },
});
