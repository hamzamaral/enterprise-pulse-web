import { createFileRoute } from '@tanstack/react-router';
import { requirePermission } from '@/features/auth/session';
import { ContractTypesPage } from '@/features/contracts/contract-types-page';

export const Route = createFileRoute('/_app/contracts/types')({
  beforeLoad: requirePermission('contracts:update'),
  component: ContractTypesPage,
});
