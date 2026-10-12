import { createFileRoute } from '@tanstack/react-router';
import { MyTasksPage } from '@/features/projects/my-tasks-page';

export const Route = createFileRoute('/_app/projects/my-tasks')({
  component: MyTasksPage,
});
