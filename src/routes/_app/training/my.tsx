import { createFileRoute } from '@tanstack/react-router';
import { MyTrainingsPage } from '@/features/training/my-trainings-page';

export const Route = createFileRoute('/_app/training/my')({
  component: MyTrainingsPage,
});
