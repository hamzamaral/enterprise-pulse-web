import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { DefinitionsPage } from '@/features/workflow/definitions-page';

export const Route = createFileRoute('/_app/workflow/definitions')({
  beforeLoad: requirePermission('workflow:read'),
  component: DefinitionsPage,
});
