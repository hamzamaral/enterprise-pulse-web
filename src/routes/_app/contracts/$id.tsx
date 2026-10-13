import { createFileRoute } from '@tanstack/react-router';
import { ContractPage } from '@/features/contracts/contract-page';

export const Route = createFileRoute('/_app/contracts/$id')({
  component: function ContractRoute() {
    const { id } = Route.useParams();
    return <ContractPage id={id} />;
  },
});
