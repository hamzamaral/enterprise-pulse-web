import { createFileRoute } from '@tanstack/react-router';
import { MyAttendancePage } from '@/features/hr/my-attendance-page';

export const Route = createFileRoute('/_app/hr/my-attendance')({
  component: MyAttendancePage,
});
