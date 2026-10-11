import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ReceiptsPage } from '@/features/purchasing/receipts-page';

export const Route = createFileRoute('/_app/purchasing/receipts/')({
  beforeLoad: requirePermission('purchasing:read'),
  component: ReceiptsPage,
});
