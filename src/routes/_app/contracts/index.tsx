import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ContractsPage } from '@/features/contracts/contracts-page';

export const Route = createFileRoute('/_app/contracts/')({
  beforeLoad: requirePermission('contracts:read'),
  component: ContractsPage,
});
