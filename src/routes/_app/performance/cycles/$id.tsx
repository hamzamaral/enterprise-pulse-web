import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ReviewCyclePage } from '@/features/performance/review-cycle-page';

export const Route = createFileRoute('/_app/performance/cycles/$id')({
  beforeLoad: requirePermission('performance:read'),
  component: function ReviewCycleRoute() {
    const { id } = Route.useParams();
    return <ReviewCyclePage id={id} />;
  },
});
