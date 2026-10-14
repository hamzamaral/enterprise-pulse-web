import type { ColumnDef } from '@tanstack/react-table';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  fuelEntriesFindAll,
  useFuelEntriesFindAll,
  useVehiclesFindAll,
} from '@/api/generated/endpoints/fleet/fleet';
import type { FuelEntriesFindAllParams, FuelEntryDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { formatConsumption, formatKm, formatLiters } from './fleet-components';

const ALL = '__all__';

/** Every fuel purchase of the fleet; searches plate, station and driver. */
export function FuelLogPage() {
  const { t } = useTranslation();
  const table = useTableState({ sort: [{ id: 'entryDate', desc: true }] });
  const [vehicleId, setVehicleId] = useState(ALL);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { data: vehicles } = useVehiclesFindAll();
  const params: FuelEntriesFindAllParams = {
    ...table.params,
    vehicleId: vehicleId === ALL ? undefined : vehicleId,
    from: from || undefined,
    to: to || undefined,
  };
  const { data, isLoading } = useFuelEntriesFindAll(params, { query: tableQuery });
  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));

  const columns = useMemo<ColumnDef<FuelEntryDto, unknown>[]>(
    () => [
      {
        id: 'entryDate',
        header: t('fleet.date'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {formatDate(row.original.entryDate)}
            {!row.original.fullTank && (
              <span className="ml-2">
                <ToneBadge tone="neutral">{t('fleet.partial')}</ToneBadge>
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'vehicle',
        header: t('fleet.vehicle'),
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            to="/fleet/$id"
            params={{ id: row.original.vehicleId }}
            className="font-mono font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.plate}
          </Link>
        ),
      },
      {
        id: 'driver',
        header: t('fleet.driver'),
        enableSorting: false,
        cell: ({ row }) => row.original.driverName ?? '—',
      },
      {
        id: 'odometer',
        header: t('fleet.odometer'),
        cell: ({ row }) => <span className="tabular-nums">{formatKm(row.original.odometer)}</span>,
      },
      {
        id: 'liters',
        header: t('fleet.liters'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatLiters(row.original.liters)}</span>
        ),
      },
      {
        id: 'amount',
        header: t('fleet.amount'),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatMoney(row.original.amount)}
            <span className="text-muted-foreground block text-xs">
              {t('fleet.perLiter', { value: formatMoney(row.original.unitPrice) })}
            </span>
          </span>
        ),
      },
      {
        id: 'consumption',
        header: t('fleet.consumption'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="tabular-nums">{formatConsumption(row.original.consumption)}</span>
        ),
      },
      {
        id: 'station',
        header: t('fleet.station'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.station ?? '—'}</span>
        ),
      },
      {
        id: 'createdBy',
        header: t('common.createdBy'),
        enableSorting: false,
        cell: ({ row }) => <span className="text-sm">{row.original.createdByName}</span>,
      },
    ],
    [t],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) =>
      fuelEntriesFindAll({ ...params, page, pageSize: 100 }),
    );
    await exportTable(
      format,
      'fuel-entries',
      [
        { header: t('fleet.date'), value: (r) => new Date(r.entryDate) },
        { header: t('fleet.plate'), value: (r) => r.plate },
        { header: t('fleet.driver'), value: (r) => r.driverName },
        { header: t('fleet.odometer'), value: (r) => r.odometer },
        { header: t('fleet.liters'), value: (r) => Number(r.liters) },
        { header: t('fleet.amount'), value: (r) => Number(r.amount) },
        { header: t('fleet.unitPrice'), value: (r) => Number(r.unitPrice) },
        { header: t('fleet.fullTank'), value: (r) => (r.fullTank ? t('common.yes') : '') },
        { header: t('fleet.distance'), value: (r) => r.distance },
        {
          header: t('fleet.consumption'),
          value: (r) => (r.consumption ? Number(r.consumption) : null),
        },
        { header: t('fleet.station'), value: (r) => r.station },
      ],
      rows,
    );
  };

  return (
    <>
      <PageHeader title={t('fleet.fuelLog.title')} description={t('fleet.fuelLog.subtitle')} />
      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        toolbar={
          <>
            <Select
              value={vehicleId}
              onValueChange={(value) => {
                setVehicleId(value);
                resetPage();
              }}
            >
              <SelectTrigger className="w-48" aria-label={t('fleet.vehicle')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('fleet.allVehicles')}</SelectItem>
                {(vehicles ?? []).map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.plate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              className="w-40"
              aria-label={t('fleet.from')}
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                resetPage();
              }}
            />
            <Input
              type="date"
              className="w-40"
              aria-label={t('fleet.to')}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                resetPage();
              }}
            />
          </>
        }
      />
    </>
  );
}
