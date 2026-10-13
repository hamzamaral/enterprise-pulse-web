import { createFileRoute } from '@tanstack/react-router';
import { TicketPage } from '@/features/support/ticket-page';

export const Route = createFileRoute('/_app/support/tickets/$id')({
  component: function TicketRoute() {
    const { id } = Route.useParams();
    return <TicketPage id={id} />;
  },
});
