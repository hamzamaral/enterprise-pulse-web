import { createFileRoute } from '@tanstack/react-router';
import { InstanceDetailPage } from '@/features/workflow/instance-detail-page';

export const Route = createFileRoute('/_app/workflow/instances/$id')({
  component: function InstanceDetailRoute() {
    const { id } = Route.useParams();
    return <InstanceDetailPage id={id} />;
  },
});
