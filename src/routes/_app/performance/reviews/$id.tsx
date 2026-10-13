import { createFileRoute } from '@tanstack/react-router';
import { ReviewPage } from '@/features/performance/review-page';

export const Route = createFileRoute('/_app/performance/reviews/$id')({
  component: function ReviewRoute() {
    const { id } = Route.useParams();
    return <ReviewPage id={id} />;
  },
});
