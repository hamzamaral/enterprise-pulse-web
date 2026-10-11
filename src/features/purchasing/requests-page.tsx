import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  purchaseRequestsFindAll,
  usePurchaseRequestsFindAll,
} from '@/api/generated/endpoints/purchasing/purchasing';
import { PurchaseRequestStatus, type PurchaseRequestDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { RequestStatusBadge } from './purchasing-components';

const ALL = 'ALL';
export const REQUESTERS = ['workflow:start', 'purchasing:create'];

export function RequestsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const buyer = can('purchasing:read');
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [mine, setMine] = useState(false);

  const params = {
    ...table.params,
    status: status === ALL ? undefined : (status as PurchaseRequestStatus),
    mine: mine || undefined,
  };
  const { data, isLoading } = usePurchaseRequestsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<PurchaseRequestDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'requestDate',
        header: t('purchasing.requests.date'),
        cell: ({ row }) => formatDate(row.original.requestDate),
      },
      {
        id: 'title',
        header: t('purchasing.requests.titleField'),
        enableSorting: false,
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'requestedBy',
        header: t('purchasing.requests.requestedBy'),
        enableSorting: false,
        cell: ({ row }) => row.original.requestedByName,
      },
      {
        id: 'neededBy',
        header: t('purchasing.requests.neededBy'),
        enableSorting: false,
        cell: ({ row }) => formatDate(row.original.neededBy),
      },
      {
        id: 'estimatedTotal',
        header: t('purchasing.requests.estimatedTotal'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.estimatedTotal)}</span>
        ),
      },
      {
        id: 'quoteCount',
        header: t('purchasing.requests.quotes'),
        enableSorting: false,
        cell: ({ row }) => row.original.quoteCount || '—',
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => <RequestStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async () => {
    const rows = await fetchAllPages((page) =>
      purchaseRequestsFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportToExcel(
      'purchase-requests',
      [
        { header: t('trade.number'), value: (r) => r.number },
        { header: t('purchasing.requests.date'), value: (r) => new Date(r.requestDate) },
        { header: t('purchasing.requests.titleField'), value: (r) => r.title },
        { header: t('purchasing.requests.requestedBy'), value: (r) => r.requestedByName },
        { header: t('purchasing.requests.department'), value: (r) => r.departmentName },
        {
          header: t('purchasing.requests.neededBy'),
          value: (r) => (r.neededBy ? new Date(r.neededBy) : null),
        },
        {
          header: t('purchasing.requests.estimatedTotal'),
          value: (r) => Number(r.estimatedTotal),
        },
        { header: t('purchasing.requests.quotes'), value: (r) => r.quoteCount },
        {
          header: t('common.status'),
          value: (r) => t(`purchasing.requestStatus.${r.status}`),
        },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('purchasing.requests.title')}
        description={
          buyer ? t('purchasing.requests.subtitle') : t('purchasing.requests.subtitleMine')
        }
        actions={
          <Can permission={REQUESTERS}>
            <Button asChild>
              <Link to="/purchasing/requests/new">
                <Plus /> {t('purchasing.requests.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) =>
          void navigate({ to: '/purchasing/requests/$id', params: { id: row.id } })
        }
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
                <SelectItem value={ALL}>{t('trade.allStatuses')}</SelectItem>
                {Object.values(PurchaseRequestStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`purchasing.requestStatus.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {buyer && (
              <div className="flex items-center gap-2">
                <Switch
                  id="mine"
                  checked={mine}
                  onCheckedChange={(checked) => {
                    setMine(checked);
                    resetPage();
                  }}
                />
                <Label htmlFor="mine" className="text-sm font-normal">
                  {t('purchasing.requests.onlyMine')}
                </Label>
              </div>
            )}
          </>
        }
      />
    </>
  );
}
