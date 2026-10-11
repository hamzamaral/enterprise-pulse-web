import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLeaveRequestsFindAll,
  useLeaveTypesFindAll,
} from '@/api/generated/endpoints/leave/leave';
import { LeaveRequestStatus } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { ColorDot } from './hr-components';
import { LeaveRequestDialog, LeaveRequestsTable } from './leave-components';

const ALL = 'all';

export function LeaveRequestsPage() {
  const { t } = useTranslation();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState<string>(ALL);
  const [leaveTypeId, setLeaveTypeId] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: types } = useLeaveTypesFindAll();

  const { data, isLoading } = useLeaveRequestsFindAll(
    {
      ...table.params,
      status: status === ALL ? undefined : (status as LeaveRequestStatus),
      leaveTypeId: leaveTypeId === ALL ? undefined : leaveTypeId,
    },
    { query: tableQuery },
  );
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  return (
    <>
      <PageHeader
        title={t('leave.requestsTitle')}
        description={t('leave.requestsSubtitle')}
        actions={
          <Can permission="leave:create">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('leave.newRequest')}
            </Button>
          </Can>
        }
      />
      <LeaveRequestsTable
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        showEmployee
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {Object.values(LeaveRequestStatus).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`leave.status.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={leaveTypeId}
              onValueChange={(value) => {
                setLeaveTypeId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('common.all')}</SelectItem>
                {types?.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <ColorDot color={type.color} />
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <LeaveRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} onBehalf />
    </>
  );
}
