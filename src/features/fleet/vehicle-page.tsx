import { Link, useNavigate } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import {
  ArrowLeft,
  Fuel,
  Gauge,
  Pencil,
  Plus,
  Trash2,
  Undo2,
  UserPlus,
  UserRoundCog,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';
import {
  useVehiclesFindOne,
  useVehiclesFuelEntries,
  useVehiclesRemove,
  useVehiclesRemoveDocument,
  useVehiclesRemoveFuel,
  useVehiclesRemoveReading,
  useVehiclesRemoveService,
} from '@/api/generated/endpoints/fleet/fleet';
import type { VehicleDetailDto, VehicleDocumentType } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { CHART_COLORS, compactNumber, KpiCard } from '@/features/reports/report-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { tableQuery } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  DocumentStateBadge,
  formatConsumption,
  formatKm,
  formatLiters,
  nextServiceText,
  ServiceStateBadge,
  useInvalidateFleet,
  VehicleStatusBadge,
} from './fleet-components';
import {
  AssignDialog,
  DocumentDialog,
  FuelDialog,
  ReadingDialog,
  ReturnDialog,
  ServiceDialog,
  VehicleFormDialog,
} from './fleet-dialogs';

type DialogKind = 'edit' | 'assign' | 'return' | 'fuel' | 'reading' | 'service' | 'document';

const isFuture = (year: number, month: number) => {
  const now = new Date();
  return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
};

const yearOptions = () => {
  const year = new Date().getFullYear();
  return [year, year - 1, year - 2];
};

export function VehiclePage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const invalidate = useInvalidateFleet();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data: vehicle, isLoading } = useVehiclesFindOne(id, { year }, { query: tableQuery });
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const [documentType, setDocumentType] = useState<VehicleDocumentType | undefined>();
  const remove = useVehiclesRemove();

  if (!vehicle) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const open = (kind: DialogKind) => ({
    open: dialog === kind,
    onOpenChange: (value: boolean) => setDialog(value ? kind : null),
  });
  const retired = vehicle.status === 'RETIRED';
  const canRecord = (vehicle.canManage || vehicle.isDriver) && !retired;
  const addDocument = (type?: VehicleDocumentType) => {
    setDocumentType(type);
    setDialog('document');
  };

  return (
    <>
      <Link
        to={can('fleet:read') ? '/fleet' : '/fleet/my'}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" />{' '}
        {can('fleet:read') ? t('fleet.title') : t('fleet.my.title')}
      </Link>
      <PageHeader
        title={vehicle.plate}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <VehicleStatusBadge status={vehicle.status} />
            <span className="text-muted-foreground text-sm">
              {vehicle.brand} {vehicle.model}
              {vehicle.modelYear ? ` · ${vehicle.modelYear}` : ''}
              {vehicle.departmentName ? ` · ${vehicle.departmentName}` : ''}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {canRecord && (
              <>
                <Button onClick={() => setDialog('fuel')}>
                  <Fuel /> {t('fleet.addFuel')}
                </Button>
                <Button variant="outline" onClick={() => setDialog('reading')}>
                  <Gauge /> {t('fleet.addReading')}
                </Button>
              </>
            )}
            {vehicle.canManage && !retired && (
              <>
                {vehicle.driver ? (
                  <>
                    <Button variant="outline" onClick={() => setDialog('assign')}>
                      <UserRoundCog /> {t('fleet.handover')}
                    </Button>
                    <Button variant="outline" onClick={() => setDialog('return')}>
                      <Undo2 /> {t('fleet.return')}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={() => setDialog('assign')}>
                    <UserPlus /> {t('fleet.assign')}
                  </Button>
                )}
              </>
            )}
            {vehicle.canManage && (
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {vehicle.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('fleet.deleted'));
                        await navigate({ to: '/fleet' });
                        await invalidate();
                      },
                    },
                  )
                }
              />
            )}
          </div>
        }
      />

      {retired && (
        <div className="bg-muted mb-4 rounded-md border p-3 text-sm">
          {t('fleet.retiredNotice', { date: formatDate(vehicle.retiredOn) })}
        </div>
      )}
      {vehicle.status === 'IN_SERVICE' && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {t('fleet.inServiceNotice')}
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="overview">{t('fleet.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="fuel">{t('fleet.tabs.fuel')}</TabsTrigger>
          <TabsTrigger value="services">
            {t('fleet.tabs.services')} ({vehicle.services.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t('fleet.tabs.documents')} ({vehicle.allDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="assignments">
            {t('fleet.tabs.assignments')} ({vehicle.assignments.length})
          </TabsTrigger>
          <TabsTrigger value="readings">{t('fleet.tabs.readings')}</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <StatsCard vehicle={vehicle} year={year} onYearChange={setYear} />
              <DetailsCard vehicle={vehicle} />
            </div>
            <div className="space-y-4">
              <DriverCard vehicle={vehicle} />
              <ServiceCard vehicle={vehicle} />
              <DocumentsCard
                vehicle={vehicle}
                onAdd={vehicle.canManage && !retired ? addDocument : undefined}
              />
            </div>
          </div>
        </TabsContent>
        <TabsContent value="fuel">
          <FuelTab vehicle={vehicle} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesTab vehicle={vehicle} onAdd={() => setDialog('service')} />
        </TabsContent>
        <TabsContent value="documents">
          <DocumentsTab vehicle={vehicle} onAdd={() => addDocument()} />
        </TabsContent>
        <TabsContent value="assignments">
          <AssignmentsTab vehicle={vehicle} />
        </TabsContent>
        <TabsContent value="readings">
          <ReadingsTab vehicle={vehicle} />
        </TabsContent>
      </Tabs>

      <VehicleFormDialog vehicle={vehicle} {...open('edit')} />
      <AssignDialog vehicle={vehicle} {...open('assign')} />
      {vehicle.driver && <ReturnDialog vehicle={vehicle} {...open('return')} />}
      <FuelDialog vehicle={vehicle} {...open('fuel')} />
      <ReadingDialog vehicle={vehicle} {...open('reading')} />
      <ServiceDialog vehicle={vehicle} {...open('service')} />
      <DocumentDialog vehicle={vehicle} type={documentType} {...open('document')} />
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

function StatsCard({
  vehicle,
  year,
  onYearChange,
}: {
  vehicle: VehicleDetailDto;
  year: number;
  onYearChange: (year: number) => void;
}) {
  const { t } = useTranslation();
  const { stats, currencyCode } = vehicle;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t('fleet.stats.title')}</CardTitle>
        <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
          <SelectTrigger className="w-28" aria-label={t('fleet.year')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions().map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
          <KpiCard label={t('fleet.stats.km')} value={formatKm(stats.km)} />
          <KpiCard
            label={t('fleet.stats.totalCost')}
            value={formatMoney(stats.totalCost, currencyCode)}
            hint={t('fleet.stats.fuelCost', {
              value: formatMoney(stats.fuelCost, currencyCode),
            })}
          />
          <KpiCard
            label={t('fleet.stats.costPerKm')}
            value={stats.costPerKm ? formatMoney(stats.costPerKm, currencyCode) : '—'}
          />
          <KpiCard
            label={t('fleet.consumption')}
            value={formatConsumption(stats.consumption)}
            hint={formatLiters(stats.liters)}
          />
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={stats.months.map((m) => ({
              label: formatDate(`${year}-${String(m.month).padStart(2, '0')}-01`, 'MMM'),
              fuel: Number(m.fuelCost),
              other: Number(m.serviceCost) + Number(m.documentCost),
              km: isFuture(year, m.month) ? null : m.km,
            }))}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
            <YAxis
              yAxisId="cost"
              tickFormatter={compactNumber}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={44}
            />
            <YAxis
              yAxisId="km"
              orientation="right"
              tickFormatter={compactNumber}
              tickLine={false}
              axisLine={false}
              fontSize={12}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
              formatter={(value, name) =>
                name === t('fleet.stats.km')
                  ? formatKm(Number(value))
                  : formatMoney(Number(value), currencyCode)
              }
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="cost"
              dataKey="fuel"
              stackId="cost"
              name={t('fleet.costKinds.fuel')}
              fill={CHART_COLORS.primary}
              maxBarSize={22}
            />
            <Bar
              yAxisId="cost"
              dataKey="other"
              stackId="cost"
              name={t('fleet.costKinds.other')}
              fill={CHART_COLORS.secondary}
              radius={[4, 4, 0, 0]}
              maxBarSize={22}
            />
            <Line
              yAxisId="km"
              dataKey="km"
              name={t('fleet.stats.km')}
              stroke="var(--chart-4)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function DetailsCard({ vehicle }: { vehicle: VehicleDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('common.details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label={t('fleet.brand')}>
            {vehicle.brand} {vehicle.model}
          </Field>
          <Field label={t('fleet.modelYear')}>{vehicle.modelYear}</Field>
          <Field label={t('fleet.color')}>{vehicle.color}</Field>
          <Field label={t('fleet.fuelType')}>{t(`fleet.fuel.${vehicle.fuelType}`)}</Field>
          <Field label={t('fleet.ownershipLabel')}>
            {t(`fleet.ownership.${vehicle.ownership}`)}
            {vehicle.contractEndsOn && (
              <span className="text-muted-foreground block text-xs">
                {t('fleet.contractUntil', { date: formatDate(vehicle.contractEndsOn) })}
              </span>
            )}
          </Field>
          <Field label={t('fleet.vin')}>
            {vehicle.vin && <code className="text-xs">{vehicle.vin}</code>}
          </Field>
          <Field label={t('fleet.department')}>{vehicle.departmentName}</Field>
          <Field label={t('fleet.odometer')}>{formatKm(vehicle.odometer)}</Field>
          <Field label={t('fleet.yearCost')}>
            {formatMoney(vehicle.yearCost, vehicle.currencyCode)}
          </Field>
          {vehicle.notes && (
            <div className="sm:col-span-3">
              <Field label={t('fleet.notes')}>
                <span className="whitespace-pre-line">{vehicle.notes}</span>
              </Field>
            </div>
          )}
          <div className="text-muted-foreground text-xs sm:col-span-3">
            {t('fleet.createdBy', {
              name: vehicle.createdByName,
              date: formatDateTime(vehicle.createdAt),
            })}
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function DriverCard({ vehicle }: { vehicle: VehicleDetailDto }) {
  const { t } = useTranslation();
  const can = usePermission();
  const { driver } = vehicle;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('fleet.driver')}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {!driver ? (
          <p className="text-muted-foreground">{t('fleet.noDriver')}</p>
        ) : (
          <>
            {can('employees:read') ? (
              <Link
                to="/hr/employees/$id"
                params={{ id: driver.employeeId }}
                className="font-medium hover:underline"
              >
                {driver.name}
              </Link>
            ) : (
              <span className="font-medium">{driver.name}</span>
            )}
            <span className="text-muted-foreground block text-xs">
              {t('fleet.driverSince', { date: formatDate(driver.since) })}
            </span>
            {vehicle.isDriver && (
              <p className="text-muted-foreground mt-2 text-xs">{t('fleet.youDrive')}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceCard({ vehicle }: { vehicle: VehicleDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t('fleet.nextService')}</CardTitle>
        <ServiceStateBadge state={vehicle.serviceState} />
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p className="font-medium">{nextServiceText(vehicle)}</p>
        <p className="text-muted-foreground text-xs">
          {vehicle.serviceIntervalKm || vehicle.serviceIntervalMonths
            ? t('fleet.intervalValue', {
                km: vehicle.serviceIntervalKm ? formatKm(vehicle.serviceIntervalKm) : '—',
                months: vehicle.serviceIntervalMonths ?? '—',
              })
            : t('fleet.noInterval')}
        </p>
      </CardContent>
    </Card>
  );
}

function daysText(daysLeft: number | null, t: TFunction) {
  if (daysLeft === null) return '';
  return daysLeft < 0
    ? t('fleet.daysOver', { count: -daysLeft })
    : t('fleet.daysLeft', { count: daysLeft });
}

function DocumentsCard({
  vehicle,
  onAdd,
}: {
  vehicle: VehicleDetailDto;
  onAdd?: (type: VehicleDocumentType) => void;
}) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('fleet.documents')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {vehicle.documents.map((doc) => (
            <li key={doc.type} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0">
                <span className="block">{t(`fleet.documentTypes.${doc.type}`)}</span>
                <span className="text-muted-foreground block text-xs">
                  {doc.endDate
                    ? `${formatDate(doc.endDate)} · ${daysText(doc.daysLeft, t)}`
                    : t('fleet.notRecorded')}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <DocumentStateBadge doc={doc} />
                {onAdd && (doc.state !== 'VALID' || !doc.endDate) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t('fleet.addDocument')}
                    onClick={() => onAdd(doc.type)}
                  >
                    <Plus />
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="text-muted-foreground py-6 text-center">
        {text}
      </TableCell>
    </TableRow>
  );
}

function DeleteButton({ onConfirm, pending }: { onConfirm: () => void; pending?: boolean }) {
  const { t } = useTranslation();
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('common.delete')}
          disabled={pending}
        >
          <Trash2 />
        </Button>
      }
      onConfirm={onConfirm}
    />
  );
}

function FuelTab({ vehicle }: { vehicle: VehicleDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useVehiclesFuelEntries(vehicle.id, { year }, { query: tableQuery });
  const remove = useVehiclesRemoveFuel();
  const cur = vehicle.currencyCode;
  const totals = (data ?? []).reduce(
    (sum, e) => ({ liters: sum.liters + Number(e.liters), amount: sum.amount + Number(e.amount) }),
    { liters: 0, amount: 0 },
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          {t('fleet.fuelEntries', { count: data?.length ?? 0 })}
          {data && data.length > 0 && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {formatLiters(totals.liters)} · {formatMoney(totals.amount, cur)}
            </span>
          )}
        </CardTitle>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger className="w-28" aria-label={t('fleet.year')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {yearOptions().map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fleet.date')}</TableHead>
                <TableHead className="text-right">{t('fleet.odometer')}</TableHead>
                <TableHead className="text-right">{t('fleet.liters')}</TableHead>
                <TableHead className="text-right">{t('fleet.amount')}</TableHead>
                <TableHead className="text-right">{t('fleet.unitPrice')}</TableHead>
                <TableHead className="text-right">{t('fleet.distance')}</TableHead>
                <TableHead className="text-right">{t('fleet.consumption')}</TableHead>
                <TableHead>{t('fleet.station')}</TableHead>
                <TableHead>{t('fleet.driver')}</TableHead>
                {vehicle.canManage && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data?.length && <EmptyRow colSpan={10} text={t('fleet.noFuel')} />}
              {data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(e.entryDate)}
                    {!e.fullTank && (
                      <span className="ml-2">
                        <ToneBadge tone="neutral">{t('fleet.partial')}</ToneBadge>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatKm(e.odometer)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatLiters(e.liters)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(e.amount, cur)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-right tabular-nums">
                    {formatMoney(e.unitPrice, cur)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.distance !== null ? formatKm(e.distance) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatConsumption(e.consumption)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.station ?? '—'}</TableCell>
                  <TableCell>{e.driverName ?? '—'}</TableCell>
                  {vehicle.canManage && (
                    <TableCell className="text-right">
                      <DeleteButton
                        pending={remove.isPending}
                        onConfirm={() =>
                          remove.mutate(
                            { id: vehicle.id, entryId: e.id },
                            {
                              onSuccess: async () => {
                                toast.success(t('fleet.fuelDeleted'));
                                await invalidate();
                              },
                            },
                          )
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ServicesTab({ vehicle, onAdd }: { vehicle: VehicleDetailDto; onAdd: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const remove = useVehiclesRemoveService();
  const total = vehicle.services.reduce((sum, s) => sum + Number(s.cost), 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">
          {t('fleet.tabs.services')}
          {vehicle.services.length > 0 && (
            <span className="text-muted-foreground ml-2 text-sm font-normal">
              {formatMoney(total, vehicle.currencyCode)}
            </span>
          )}
        </CardTitle>
        {vehicle.canManage && vehicle.status !== 'RETIRED' && (
          <Button size="sm" onClick={onAdd}>
            <Plus /> {t('fleet.addService')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fleet.date')}</TableHead>
              <TableHead>{t('fleet.serviceType')}</TableHead>
              <TableHead className="text-right">{t('fleet.odometer')}</TableHead>
              <TableHead>{t('fleet.workshop')}</TableHead>
              <TableHead>{t('common.description')}</TableHead>
              <TableHead className="text-right">{t('fleet.cost')}</TableHead>
              {vehicle.canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!vehicle.services.length && <EmptyRow colSpan={7} text={t('fleet.noServices')} />}
            {vehicle.services.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="whitespace-nowrap">{formatDate(s.serviceDate)}</TableCell>
                <TableCell>
                  <ToneBadge tone={s.type === 'PERIODIC' ? 'info' : 'neutral'}>
                    {t(`fleet.serviceTypes.${s.type}`)}
                  </ToneBadge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.odometer !== null ? formatKm(s.odometer) : '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">{s.partnerName ?? '—'}</TableCell>
                <TableCell className="max-w-80 truncate" title={s.description}>
                  {s.description}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(s.cost, vehicle.currencyCode)}
                </TableCell>
                {vehicle.canManage && (
                  <TableCell className="text-right">
                    <DeleteButton
                      pending={remove.isPending}
                      onConfirm={() =>
                        remove.mutate(
                          { id: vehicle.id, serviceId: s.id },
                          {
                            onSuccess: async () => {
                              toast.success(t('fleet.serviceDeleted'));
                              await invalidate();
                            },
                          },
                        )
                      }
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DocumentsTab({ vehicle, onAdd }: { vehicle: VehicleDetailDto; onAdd: () => void }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const remove = useVehiclesRemoveDocument();
  const states = new Map(vehicle.documents.map((d) => [d.type, d]));
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">{t('fleet.documents')}</CardTitle>
        {vehicle.canManage && vehicle.status !== 'RETIRED' && (
          <Button size="sm" onClick={onAdd}>
            <Plus /> {t('fleet.addDocument')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fleet.documentType')}</TableHead>
              <TableHead>{t('fleet.validity')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('fleet.provider')}</TableHead>
              <TableHead>{t('fleet.policyNumber')}</TableHead>
              <TableHead className="text-right">{t('fleet.cost')}</TableHead>
              {vehicle.canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!vehicle.allDocuments.length && <EmptyRow colSpan={7} text={t('fleet.noDocuments')} />}
            {vehicle.allDocuments.map((d) => {
              const state = states.get(d.type);
              return (
                <TableRow key={d.id} className={cn(!d.isCurrent && 'text-muted-foreground')}>
                  <TableCell>{t(`fleet.documentTypes.${d.type}`)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {d.startDate ? `${formatDate(d.startDate)} – ` : ''}
                    {formatDate(d.endDate)}
                  </TableCell>
                  <TableCell>
                    {d.isCurrent && state ? (
                      <DocumentStateBadge doc={state} />
                    ) : (
                      <ToneBadge tone="neutral">{t('fleet.previousTerm')}</ToneBadge>
                    )}
                  </TableCell>
                  <TableCell>{d.provider ?? '—'}</TableCell>
                  <TableCell>
                    {d.policyNumber ? <code className="text-xs">{d.policyNumber}</code> : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(d.cost, vehicle.currencyCode)}
                  </TableCell>
                  {vehicle.canManage && (
                    <TableCell className="text-right">
                      <DeleteButton
                        pending={remove.isPending}
                        onConfirm={() =>
                          remove.mutate(
                            { id: vehicle.id, documentId: d.id },
                            {
                              onSuccess: async () => {
                                toast.success(t('fleet.documentDeleted'));
                                await invalidate();
                              },
                            },
                          )
                        }
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AssignmentsTab({ vehicle }: { vehicle: VehicleDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('fleet.tabs.assignments')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fleet.driver')}</TableHead>
              <TableHead>{t('fleet.period')}</TableHead>
              <TableHead className="text-right">{t('fleet.startKm')}</TableHead>
              <TableHead className="text-right">{t('fleet.endKm')}</TableHead>
              <TableHead className="text-right">{t('fleet.driven')}</TableHead>
              <TableHead>{t('fleet.note')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!vehicle.assignments.length && (
              <EmptyRow colSpan={6} text={t('fleet.noAssignments')} />
            )}
            {vehicle.assignments.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  {a.employeeName}
                  <span className="text-muted-foreground block text-xs">
                    {a.departmentName ?? ''}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {formatDate(a.startDate)} – {a.endDate ? formatDate(a.endDate) : ''}
                  {!a.endDate && <ToneBadge tone="success">{t('fleet.current')}</ToneBadge>}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatKm(a.startOdometer)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {a.endOdometer !== null ? formatKm(a.endOdometer) : '—'}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatKm((a.endOdometer ?? vehicle.odometer) - a.startOdometer)}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-72 text-xs whitespace-pre-line">
                  {a.note ?? ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReadingsTab({ vehicle }: { vehicle: VehicleDetailDto }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateFleet();
  const remove = useVehiclesRemoveReading();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('fleet.tabs.readings')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fleet.date')}</TableHead>
              <TableHead className="text-right">{t('fleet.odometer')}</TableHead>
              <TableHead>{t('fleet.source')}</TableHead>
              <TableHead>{t('fleet.note')}</TableHead>
              <TableHead>{t('common.createdBy')}</TableHead>
              {vehicle.canManage && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!vehicle.readings.length && <EmptyRow colSpan={6} text={t('fleet.noReadings')} />}
            {vehicle.readings.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{formatDate(r.readingDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatKm(r.odometer)}</TableCell>
                <TableCell>{t(`fleet.sources.${r.source}`)}</TableCell>
                <TableCell className="text-muted-foreground">{r.note ?? ''}</TableCell>
                <TableCell className="text-muted-foreground">{r.createdByName ?? '—'}</TableCell>
                {vehicle.canManage && (
                  <TableCell className="text-right">
                    {r.source === 'MANUAL' && (
                      <DeleteButton
                        pending={remove.isPending}
                        onConfirm={() =>
                          remove.mutate(
                            { id: vehicle.id, readingId: r.id },
                            {
                              onSuccess: async () => {
                                toast.success(t('fleet.readingDeleted'));
                                await invalidate();
                              },
                            },
                          )
                        }
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
