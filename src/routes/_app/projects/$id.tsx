import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ProjectDetailPage } from '@/features/projects/project-detail-page';

const searchSchema = z.object({
  tab: z.enum(['overview', 'tasks', 'time', 'expenses']).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/projects/$id')({
  validateSearch: searchSchema,
  component: function ProjectDetailRoute() {
    const { id } = Route.useParams();
    const { tab } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <ProjectDetailPage
        id={id}
        tab={tab ?? 'overview'}
        onTabChange={(next) =>
          void navigate({ search: { tab: next === 'overview' ? undefined : next }, replace: true })
        }
      />
    );
  },
});
