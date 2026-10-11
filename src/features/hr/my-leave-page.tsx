import { Plus, UserX } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEmployeesFindMine } from '@/api/generated/endpoints/employees/employees';
import {
  useLeaveBalancesFindAll,
  useLeaveRequestsFindAll,
} from '@/api/generated/endpoints/leave/leave';
import { useMe } from '@/features/auth/use-session';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { BalanceCards, LeaveRequestDialog, LeaveRequestsTable } from './leave-components';

export function MyLeavePage() {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const { data: session } = useMe();
  const noEmployee = !!session && !session.employeeId;
  const me = useEmployeesFindMine({ query: { enabled: !!session?.employeeId } });
  const hasEmployee = me.isSuccess;
  const balances = useLeaveBalancesFindAll(
    { year: new Date().getFullYear() },
    { query: { enabled: hasEmployee } },
  );
  const requests = useLeaveRequestsFindAll(
    { ...table.params, mine: 'true' },
    { query: { ...tableQuery, enabled: hasEmployee } },
  );

  return (
    <>
      <PageHeader
        title={t('leave.myTitle')}
        description={t('leave.mySubtitle')}
        actions={
          hasEmployee && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> {t('leave.newRequest')}
            </Button>
          )
        }
      />
      {noEmployee || me.isError ? (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-3 text-sm">
            <UserX className="size-5" />
            {t('leave.noEmployee')}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-medium">{t('leave.balances')}</h2>
            <BalanceCards balances={balances.data} isLoading={me.isLoading || balances.isLoading} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">{t('nav.leaveRequests')}</h2>
            <LeaveRequestsTable
              data={requests.data?.data}
              meta={requests.data?.meta}
              isLoading={me.isLoading || requests.isLoading}
              state={table}
              searchable={false}
            />
          </section>
        </div>
      )}
      <LeaveRequestDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
}
