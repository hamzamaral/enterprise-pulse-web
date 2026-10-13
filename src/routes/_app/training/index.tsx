import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TrainingSessionsPage } from '@/features/training/training-sessions-page';

export const Route = createFileRoute('/_app/training/')({
  beforeLoad: requirePermission('training:read'),
  component: TrainingSessionsPage,
});
