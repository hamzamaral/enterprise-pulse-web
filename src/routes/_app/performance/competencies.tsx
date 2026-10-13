import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { CompetenciesPage } from '@/features/performance/competencies-page';

export const Route = createFileRoute('/_app/performance/competencies')({
  beforeLoad: requirePermission('performance:read'),
  component: CompetenciesPage,
});
