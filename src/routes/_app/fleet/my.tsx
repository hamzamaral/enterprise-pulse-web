import { createFileRoute } from '@tanstack/react-router';
import { MyVehiclesPage } from '@/features/fleet/my-vehicles-page';

export const Route = createFileRoute('/_app/fleet/my')({
  component: MyVehiclesPage,
});
