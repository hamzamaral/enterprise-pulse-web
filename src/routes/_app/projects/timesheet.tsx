import { createFileRoute } from '@tanstack/react-router';
import { TimesheetPage } from '@/features/projects/timesheet-page';

export const Route = createFileRoute('/_app/projects/timesheet')({
  component: TimesheetPage,
});
