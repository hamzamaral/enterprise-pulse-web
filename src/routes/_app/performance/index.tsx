import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ReviewCyclesPage } from '@/features/performance/review-cycles-page';

export const Route = createFileRoute('/_app/performance/')({
  beforeLoad: requirePermission('performance:read'),
  component: ReviewCyclesPage,
});
