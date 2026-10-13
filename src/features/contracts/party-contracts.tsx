import { useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useContractsFindAll } from '@/api/generated/endpoints/contracts/contracts';
import type { ContractsFindAllParams } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { useContractColumns } from './contract-components';
import { ContractFormDialog, type ContractPreset } from './contract-form-dialog';

/** Contracts card on partner and employee pages. */
export function PartyContracts({
  filter,
  preset,
}: {
  filter: Pick<ContractsFindAllParams, 'partnerId' | 'employeeId'>;
  preset: ContractPreset;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ pageSize: 10, sort: [{ id: 'endDate', desc: true }] });
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useContractsFindAll(
    { ...table.params, ...filter },
    { query: tableQuery },
  );
  const columns = useContractColumns(true);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('contracts.title')}</CardTitle>
        <Can permission="contracts:create">
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus /> {t('contracts.new')}
          </Button>
        </Can>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={data?.data}
          meta={data?.meta}
          isLoading={isLoading}
          state={table}
          searchable={false}
          onRowClick={(row) => void navigate({ to: '/contracts/$id', params: { id: row.id } })}
        />
      </CardContent>
      <ContractFormDialog
        open={creating}
        onOpenChange={setCreating}
        preset={preset}
        onSaved={(contract) => void navigate({ to: '/contracts/$id', params: { id: contract.id } })}
      />
    </Card>
  );
}
