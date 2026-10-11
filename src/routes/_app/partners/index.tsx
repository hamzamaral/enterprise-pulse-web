import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { PartnersPage } from '@/features/partners/partners-page';

export const Route = createFileRoute('/_app/partners/')({
  beforeLoad: requirePermission('partners:read'),
  component: PartnersPage,
});
