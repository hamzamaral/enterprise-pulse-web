import { createFileRoute } from '@tanstack/react-router';
import { MyInterviewsPage } from '@/features/recruitment/my-interviews-page';

export const Route = createFileRoute('/_app/recruitment/interviews')({
  component: MyInterviewsPage,
});
