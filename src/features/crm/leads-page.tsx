import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { leadsFindAll, useLeadsFindAll } from '@/api/generated/endpoints/crm/crm';
import { LeadSource, LeadStatus, type LeadDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { LeadStatusBadge } from './crm-components';
import { LeadFormDialog } from './lead-form-dialog';

const ALL = 'ALL';
const ACTIVE = 'ACTIVE';

export function LeadsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ACTIVE);
  const [source, setSource] = useState(ALL);
  const [mine, setMine] = useState(false);
  const [creating, setCreating] = useState(false);

  const params = {
    ...table.params,
    status: status === ALL || status === ACTIVE ? undefined : (status as LeadStatus),
    active: status === ACTIVE ? ('true' as const) : undefined,
    source: source === ALL ? undefined : (source as LeadSource),
    mine: mine ? ('true' as const) : undefined,
  };
  const { data, isLoading } = useLeadsFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<LeadDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('trade.number'),
        cell: ({ row }) => <code className="text-xs">{row.original.number}</code>,
      },
      {
        id: 'companyName',
        header: t('crm.leads.companyName'),
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium">{row.original.companyName}</div>
            {row.original.contactName && (
              <div className="text-muted-foreground text-xs">{row.original.contactName}</div>
            )}
          </div>
        ),
      },
      {
        id: 'city',
        header: t('common.city'),
        enableSorting: false,
        cell: ({ row }) => row.original.city,
      },
      {
        id: 'source',
        header: t('crm.leads.source'),
        enableSorting: false,
        cell: ({ row }) => t(`crm.leads.sources.${row.original.source}`),
      },
      {
        id: 'estimatedValue',
        header: t('crm.leads.estimatedValue'),
        cell: ({ row }) =>
          row.original.estimatedValue ? (
            <span className="tabular-nums">
              {formatMoney(row.original.estimatedValue, row.original.currencyCode)}
            </span>
          ) : null,
      },
      {
        id: 'owner',
        header: t('crm.owner'),
        enableSorting: false,
        cell: ({ row }) => row.original.ownerName,
      },
      {
        id: 'createdAt',
        header: t('common.createdAt'),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <LeadStatusBadge status={row.original.status} />,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => leadsFindAll({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      'leads',
      [
        { header: t('trade.number'), value: (l) => l.number },
        { header: t('crm.leads.companyName'), value: (l) => l.companyName },
        { header: t('crm.leads.contactName'), value: (l) => l.contactName },
        { header: t('common.email'), value: (l) => l.email },
        { header: t('common.phone'), value: (l) => l.phone },
        { header: t('common.city'), value: (l) => l.city },
        { header: t('crm.leads.source'), value: (l) => t(`crm.leads.sources.${l.source}`) },
        {
          header: t('crm.leads.estimatedValue'),
          value: (l) => (l.estimatedValue ? Number(l.estimatedValue) : null),
        },
        { header: t('trade.currency'), value: (l) => l.currencyCode },
        { header: t('crm.owner'), value: (l) => l.ownerName },
        { header: t('common.createdAt'), value: (l) => new Date(l.createdAt) },
        { header: t('common.status'), value: (l) => t(`crm.leads.statuses.${l.status}`) },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader
        title={t('crm.leads.title')}
        description={t('crm.leads.subtitle')}
        actions={
          <Can permission="crm:create">
            <Button onClick={() => setCreating(true)}>
              <Plus /> {t('crm.leads.new')}
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
        onRowClick={(row) => void navigate({ to: '/crm/leads/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ACTIVE}>{t('crm.leads.activeOnly')}</SelectItem>
                <SelectItem value={ALL}>{t('crm.leads.allStatuses')}</SelectItem>
                {Object.values(LeadStatus).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`crm.leads.statuses.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={source}
              onValueChange={(value) => {
                setSource(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('crm.leads.allSources')}</SelectItem>
                {Object.values(LeadSource).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`crm.leads.sources.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="leads-mine"
                checked={mine}
                onCheckedChange={(value) => {
                  setMine(value);
                  resetPage();
                }}
              />
              <Label htmlFor="leads-mine">{t('crm.mine')}</Label>
            </div>
          </>
        }
      />
      <LeadFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(lead) => void navigate({ to: '/crm/leads/$id', params: { id: lead.id } })}
      />
    </>
  );
}
