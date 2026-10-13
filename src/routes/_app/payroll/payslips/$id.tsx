import { createFileRoute } from '@tanstack/react-router';
import { PayslipPage } from '@/features/payroll/payslip-page';

export const Route = createFileRoute('/_app/payroll/payslips/$id')({
  component: function PayslipRoute() {
    const { id } = Route.useParams();
    return <PayslipPage id={id} />;
  },
});
