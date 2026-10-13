import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { TrainingSessionPage } from '@/features/training/training-session-page';

export const Route = createFileRoute('/_app/training/sessions/$id')({
  beforeLoad: requirePermission('training:read'),
  component: function TrainingSessionRoute() {
    const { id } = Route.useParams();
    return <TrainingSessionPage id={id} />;
  },
});
