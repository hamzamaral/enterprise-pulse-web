import { createFileRoute } from '@tanstack/react-router';
import { VehiclePage } from '@/features/fleet/vehicle-page';

export const Route = createFileRoute('/_app/fleet/$id')({
  component: function VehicleRoute() {
    const { id } = Route.useParams();
    return <VehiclePage id={id} key={id} />;
  },
});
