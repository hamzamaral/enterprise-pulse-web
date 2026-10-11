import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { QuotesPage } from '@/features/purchasing/quotes-page';

export const Route = createFileRoute('/_app/purchasing/quotes/')({
  beforeLoad: requirePermission('purchasing:read'),
  component: QuotesPage,
});
