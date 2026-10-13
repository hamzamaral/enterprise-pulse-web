import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TrainingCoursesPage } from '@/features/training/training-courses-page';

export const Route = createFileRoute('/_app/training/courses')({
  beforeLoad: requirePermission('training:read'),
  component: TrainingCoursesPage,
});
