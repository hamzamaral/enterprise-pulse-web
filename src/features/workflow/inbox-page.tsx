import { useTranslation } from 'react-i18next';
import { useWorkflowInstancesInbox } from '@/api/generated/endpoints/workflow/workflow';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { tableQuery } from '@/shared/lib/query';
import { InstancesTable } from './workflow-components';

export function InboxPage() {
  const { t } = useTranslation();
  const table = useTableState();
  const { data, isLoading } = useWorkflowInstancesInbox(table.params, { query: tableQuery });

  return (
    <>
      <PageHeader title={t('workflow.inboxTitle')} description={t('workflow.inboxSubtitle')} />
      <InstancesTable data={data?.data} meta={data?.meta} isLoading={isLoading} state={table} />
    </>
  );
}
