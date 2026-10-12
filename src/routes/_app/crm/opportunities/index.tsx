import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { requirePermission } from '@/features/auth/session';
import { OpportunitiesPage } from '@/features/crm/opportunities-page';

const searchSchema = z.object({
  view: z.enum(['board', 'list']).optional().catch(undefined),
});

export const Route = createFileRoute('/_app/crm/opportunities/')({
  validateSearch: searchSchema,
  beforeLoad: requirePermission('crm:read'),
  component: function OpportunitiesRoute() {
    const { view } = Route.useSearch();
    const navigate = Route.useNavigate();
    return (
      <OpportunitiesPage
        view={view ?? 'board'}
        onViewChange={(next) =>
          void navigate({ search: { view: next === 'board' ? undefined : next }, replace: true })
        }
      />
    );
  },
});
