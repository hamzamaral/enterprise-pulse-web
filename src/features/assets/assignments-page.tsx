import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  assetAssignmentsFindAll,
  useAssetAssignmentsFindAll,
} from '@/api/generated/endpoints/assets/assets';
import { AssigneeType, AssignmentStatus } from '@/api/generated/model';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { AssignmentsTable } from './assignments-table';

const ALL = 'all';

export function AssignmentsPage() {
  const { t } = useTranslation();
  const table = useTableState({ sort: [{ id: 'assignedAt', desc: true }] });
  const [status, setStatus] = useState<string>(AssignmentStatus.ACTIVE);
  const [assigneeType, setAssigneeType] = useState<string>(ALL);

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as AssignmentStatus),
    assigneeType: assigneeType === ALL ? undefined : (assigneeType as AssigneeType),
  };
  const { data, isLoading } = useAssetAssignmentsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      assetAssignmentsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'assignments',
      [
        { header: t('assets.assignmentNo'), value: (a) => a.number },
        { header: t('assets.assetTag'), value: (a) => a.assetTag },
        { header: t('assets.asset'), value: (a) => a.assetName },
        {
          header: t('assets.assigneeType'),
          value: (a) => t(`assets.assigneeTypes.${a.assigneeType}`),
        },
        { header: t('assets.assignee'), value: (a) => a.assigneeName },
        { header: t('assets.assignedAt'), value: (a) => new Date(a.assignedAt) },
        {
          header: t('assets.returnedAt'),
          value: (a) => (a.returnedAt ? new Date(a.returnedAt) : null),
        },
        {
          header: t('assets.acknowledged'),
          value: (a) => (a.acknowledgedAt ? new Date(a.acknowledgedAt) : null),
        },
        { header: t('common.status'), value: (a) => t(`assets.assignmentStatus.${a.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('assets.assignmentsTitle')}
        description={t('assets.assignmentsSubtitle')}
      />
      <AssignmentsTable
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        searchable
        onExport={handleExport}
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {Object.values(AssignmentStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`assets.assignmentStatus.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={assigneeType}
              onValueChange={(value) => {
                setAssigneeType(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('assets.allAssigneeTypes')}</SelectItem>
                {Object.values(AssigneeType).map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`assets.assigneeTypes.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
    </>
  );
}
