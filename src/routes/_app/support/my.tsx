import { createFileRoute } from '@tanstack/react-router';
import { MyTicketsPage } from '@/features/support/my-tickets-page';

export const Route = createFileRoute('/_app/support/my')({
  component: MyTicketsPage,
});
