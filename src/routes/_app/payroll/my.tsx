import { createFileRoute } from '@tanstack/react-router';
import { MyPayslipsPage } from '@/features/payroll/my-payslips-page';

export const Route = createFileRoute('/_app/payroll/my')({
  component: MyPayslipsPage,
});
