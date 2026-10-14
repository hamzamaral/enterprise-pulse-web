import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { Link, useNavigate } from '@tanstack/react-router';
import { BellRing, Fuel, Loader2, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  useVehiclesFindAll,
  useVehiclesRun,
  useVehiclesSummary,
} from '@/api/generated/endpoints/fleet/fleet';
import type {
  FleetAlertDto,
  FleetSummaryDto,
  VehicleDto,
  VehicleStatus,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { CHART_COLORS, compactNumber, KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  AttentionBadges,
  formatConsumption,
  formatKm,
  nextServiceText,
  ServiceStateBadge,
  useInvalidateFleet,
  VehicleStatusBadge,
} from './fleet-components';
import { VehicleFormDialog } from './fleet-dialogs';

const ON_ROAD = '__on_road__';
const ALL = '__all__';
const STATUSES: VehicleStatus[] = ['ACTIVE', 'IN_SERVICE', 'RETIRED'];

/** Fleet dashboard and vehicle register. */
export function FleetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateFleet();
  const [status, setStatus] = useState(ON_ROAD);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: summary } = useVehiclesSummary();
  const { data: vehicles, isLoading } = useVehiclesFindAll(
    status === ON_ROAD || status === ALL ? {} : { status: status as VehicleStatus },
  );
  const run = useVehiclesRun();
  const currency = summary?.currencyCode ?? 'TRY';

  const rows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    return (vehicles ?? [])
      .filter((v) => status !== ON_ROAD || v.status !== 'RETIRED')
      .filter(
        (v) =>
          !term ||
          [v.plate, v.brand, v.model, v.driver?.name, v.departmentName]
            .filter(Boolean)
            .some((text) => text!.toLocaleLowerCase('tr').includes(term)),
      );
  }, [vehicles, status, search]);

  const columns = useMemo<ColumnDef<VehicleDto, unknown>[]>(
    () => [
      {
        id: 'plate',
        header: t('fleet.vehicle'),
        cell: ({ row }) => (
          <span className="block">
            <span className="font-mono font-semibold">{row.original.plate}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.brand} {row.original.model}
              {row.original.modelYear ? ` · ${row.original.modelYear}` : ''}
            </span>
          </span>
        ),
      },
      {
        id: 'driver',
        header: t('fleet.driver'),
        cell: ({ row }) =>
          row.original.driver ? (
            <span className="block">
              {row.original.driver.name}
              <span className="text-muted-foreground block text-xs">
                {row.original.departmentName ?? ''}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              {t('fleet.noDriver')}
              {row.original.departmentName ? ` · ${row.original.departmentName}` : ''}
            </span>
          ),
      },
      {
        id: 'odometer',
        header: t('fleet.odometer'),
        cell: ({ row }) => <span className="tabular-nums">{formatKm(row.original.odometer)}</span>,
      },
      {
        id: 'service',
        header: t('fleet.nextService'),
        cell: ({ row }) => (
          <span className="block">
            <ServiceStateBadge state={row.original.serviceState} />
            <span className="text-muted-foreground block text-xs">
              {nextServiceText(row.original)}
            </span>
          </span>
        ),
      },
      {
        id: 'attention',
        header: t('fleet.attention'),
        cell: ({ row }) => <AttentionBadges vehicle={row.original} />,
      },
      {
        id: 'consumption',
        header: t('fleet.consumption'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatConsumption(row.original.consumption)}</span>
        ),
      },
      {
        id: 'yearCost',
        header: t('fleet.yearCost'),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatMoney(row.original.yearCost, currency)}</span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <VehicleStatusBadge status={row.original.status} />,
      },
    ],
    [t, currency],
  );

  const handleExport = (format: ExportFormat) =>
    exportTable(
      format,
      'vehicles',
      [
        { header: t('fleet.plate'), value: (r) => r.plate },
        { header: t('fleet.brand'), value: (r) => r.brand },
        { header: t('fleet.model'), value: (r) => r.model },
        { header: t('fleet.modelYear'), value: (r) => r.modelYear },
        { header: t('fleet.fuelType'), value: (r) => t(`fleet.fuel.${r.fuelType}`) },
        { header: t('fleet.ownershipLabel'), value: (r) => t(`fleet.ownership.${r.ownership}`) },
        { header: t('fleet.department'), value: (r) => r.departmentName },
        { header: t('fleet.driver'), value: (r) => r.driver?.name ?? null },
        { header: t('fleet.odometer'), value: (r) => r.odometer },
        { header: t('fleet.nextServiceKm'), value: (r) => r.nextServiceKm },
        {
          header: t('fleet.nextServiceDate'),
          value: (r) => (r.nextServiceDate ? new Date(r.nextServiceDate) : null),
        },
        {
          header: t('fleet.consumption'),
          value: (r) => (r.consumption ? Number(r.consumption) : null),
        },
        { header: t('fleet.yearCost'), value: (r) => Number(r.yearCost) },
        { header: t('common.status'), value: (r) => t(`fleet.status.${r.status}`) },
      ],
      rows,
    );

  const runNow = () =>
    run.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('fleet.runDone', { ...result }));
        await invalidate();
      },
    });

  return (
    <>
      <PageHeader
        title={t('fleet.title')}
        description={t('fleet.subtitle')}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/fleet/fuel">
                <Fuel /> {t('fleet.fuelLog.title')}
              </Link>
            </Button>
            <Can permission="fleet:update">
              <Button variant="outline" disabled={run.isPending} onClick={runNow}>
                {run.isPending ? <Loader2 className="animate-spin" /> : <BellRing />}
                {t('fleet.runNow')}
              </Button>
              <Button onClick={() => setCreating(true)}>
                <Plus /> {t('fleet.new')}
              </Button>
            </Can>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('fleet.summary.vehicles')}
          value={summary?.total}
          hint={
            summary &&
            t('fleet.summary.vehiclesHint', {
              assigned: summary.assigned,
              unassigned: summary.unassigned,
              inService: summary.inService,
            })
          }
        />
        <KpiCard
          label={t('fleet.summary.yearCost')}
          value={summary && formatMoney(summary.yearCost, currency)}
          hint={
            summary &&
            t('fleet.summary.yearCostHint', { fuel: formatMoney(summary.yearFuelCost, currency) })
          }
        />
        <KpiCard
          label={t('fleet.summary.yearKm')}
          value={summary && formatKm(summary.yearKm)}
          hint={
            summary &&
            (summary.costPerKm
              ? t('fleet.summary.costPerKm', { value: formatMoney(summary.costPerKm, currency) })
              : '—')
          }
        />
        <KpiCard
          label={t('fleet.summary.consumption')}
          value={summary && formatConsumption(summary.consumption)}
          hint={summary && t('fleet.summary.consumptionHint')}
        />
      </div>
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <CostChart summary={summary} />
        <AlertsCard summary={summary} />
      </div>
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        searchable={false}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/fleet/$id', params: { id: row.id } })}
        toolbar={
          <>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('fleet.searchPlaceholder')}
              aria-label={t('common.search')}
              className="w-64"
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40" aria-label={t('common.status')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ON_ROAD}>{t('fleet.onRoad')}</SelectItem>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`fleet.status.${value}`)}
                  </SelectItem>
                ))}
                <SelectItem value={ALL}>{t('fleet.allVehicles')}</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />
      <VehicleFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(vehicle) => void navigate({ to: '/fleet/$id', params: { id: vehicle.id } })}
      />
    </>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

/** Fuel, service and document costs of the last 12 months. */
function CostChart({ summary }: { summary: FleetSummaryDto | undefined }) {
  const { t } = useTranslation();
  const currency = summary?.currencyCode ?? 'TRY';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('fleet.summary.monthlyCost')}</CardTitle>
      </CardHeader>
      <CardContent>
        {!summary ? (
          <Skeleton className="h-60" />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={summary.months.map((m) => ({
                label: formatDate(`${m.month}-01`, 'MMM yy'),
                fuel: Number(m.fuelCost),
                service: Number(m.serviceCost),
                document: Number(m.documentCost),
              }))}
              margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                tickFormatter={compactNumber}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                width={44}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                formatter={(value) => formatMoney(Number(value), currency)}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="fuel"
                stackId="cost"
                name={t('fleet.costKinds.fuel')}
                fill={CHART_COLORS.primary}
                maxBarSize={24}
              />
              <Bar
                dataKey="service"
                stackId="cost"
                name={t('fleet.costKinds.service')}
                fill={CHART_COLORS.secondary}
                maxBarSize={24}
              />
              <Bar
                dataKey="document"
                stackId="cost"
                name={t('fleet.costKinds.document')}
                fill="var(--chart-4)"
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

const SEVERE = ['EXPIRED', 'OVERDUE', 'MISSING'];

function alertDetail(alert: FleetAlertDto, t: TFunction) {
  if (alert.state === 'MISSING') return t('fleet.alert.missing');
  const parts: string[] = [];
  if (alert.kmLeft !== null) {
    parts.push(
      alert.kmLeft < 0
        ? t('fleet.alert.kmOver', { km: formatKm(-alert.kmLeft) })
        : t('fleet.alert.kmLeft', { km: formatKm(alert.kmLeft) }),
    );
  }
  if (alert.daysLeft !== null) {
    parts.push(
      alert.daysLeft < 0
        ? t('fleet.alert.daysOver', { count: -alert.daysLeft, date: formatDate(alert.date) })
        : t('fleet.alert.daysLeft', { count: alert.daysLeft, date: formatDate(alert.date) }),
    );
  }
  return parts.join(' · ');
}

/** Missing and expiring documents, due services and ending lease contracts. */
function AlertsCard({ summary }: { summary: FleetSummaryDto | undefined }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t('fleet.summary.alerts')}
          {summary && summary.alerts.length > 0 && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              ({summary.alerts.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!summary && <Skeleton className="h-60" />}
        {summary && !summary.alerts.length && (
          <p className="text-muted-foreground text-sm">{t('fleet.summary.noAlerts')}</p>
        )}
        {summary && summary.alerts.length > 0 && (
          <ul className="max-h-60 divide-y overflow-y-auto pr-1 text-sm">
            {summary.alerts.map((alert) => (
              <li
                key={`${alert.vehicleId}-${alert.kind}`}
                className="flex items-center justify-between gap-3 py-2"
              >
                <Link
                  to="/fleet/$id"
                  params={{ id: alert.vehicleId }}
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate">
                    <span className="font-mono font-medium">{alert.plate}</span> ·{' '}
                    {t(`fleet.alertKinds.${alert.kind}`)}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {alertDetail(alert, t)}
                  </span>
                </Link>
                <ToneBadge tone={SEVERE.includes(alert.state) ? 'danger' : 'warning'}>
                  {t(`fleet.alertStates.${alert.state}`)}
                </ToneBadge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
