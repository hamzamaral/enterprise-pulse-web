import { createFileRoute } from '@tanstack/react-router';
import { InboxPage } from '@/features/workflow/inbox-page';

export const Route = createFileRoute('/_app/workflow/inbox')({
  component: InboxPage,
});
