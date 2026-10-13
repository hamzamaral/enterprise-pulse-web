import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { JobPostingsPage } from '@/features/recruitment/job-postings-page';

export const Route = createFileRoute('/_app/recruitment/')({
  beforeLoad: requirePermission('recruitment:read'),
  component: JobPostingsPage,
});
