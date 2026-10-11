import { createFileRoute } from '@tanstack/react-router';
import { OrgChartPage } from '@/features/hr/org-chart-page';

export const Route = createFileRoute('/_app/hr/org-chart')({
  component: OrgChartPage,
});
