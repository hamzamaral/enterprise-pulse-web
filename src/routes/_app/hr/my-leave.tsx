import { createFileRoute } from '@tanstack/react-router';
import { MyLeavePage } from '@/features/hr/my-leave-page';

export const Route = createFileRoute('/_app/hr/my-leave')({
  component: MyLeavePage,
});
