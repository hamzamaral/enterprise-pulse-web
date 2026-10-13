import { createFileRoute } from '@tanstack/react-router';
import { MyReviewsPage } from '@/features/performance/my-reviews-page';

export const Route = createFileRoute('/_app/performance/my')({
  component: MyReviewsPage,
});
