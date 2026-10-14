import { Link } from '@tanstack/react-router';
import { CarFront, ChevronRight, Fuel, Gauge } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useVehiclesMy } from '@/api/generated/endpoints/fleet/fleet';
import type { VehicleDto } from '@/api/generated/model';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  DocumentStateBadge,
  formatConsumption,
  formatKm,
  nextServiceText,
  ServiceStateBadge,
  VehicleStatusBadge,
} from './fleet-components';
import { FuelDialog, ReadingDialog } from './fleet-dialogs';

/** The vehicles assigned to the signed-in employee, with fuel and odometer entry. */
export function MyVehiclesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useVehiclesMy();
  return (
    <>
      <PageHeader title={t('fleet.my.title')} description={t('fleet.my.subtitle')} />
      {isLoading && <Skeleton className="h-64" />}
      {data && !data.length && (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <CarFront className="size-8" />
            {t('fleet.my.empty')}
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {data?.map((vehicle) => (
          <MyVehicleCard key={vehicle.id} vehicle={vehicle} />
        ))}
      </div>
    </>
  );
}

function MyVehicleCard({ vehicle }: { vehicle: VehicleDto }) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<'fuel' | 'reading' | null>(null);
  const active = vehicle.status !== 'RETIRED';
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="font-mono text-xl">{vehicle.plate}</CardTitle>
          <p className="text-muted-foreground text-sm">
            {vehicle.brand} {vehicle.model}
            {vehicle.modelYear ? ` · ${vehicle.modelYear}` : ''}
          </p>
        </div>
        <VehicleStatusBadge status={vehicle.status} />
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label={t('fleet.odometer')}>{formatKm(vehicle.odometer)}</Field>
          <Field label={t('fleet.nextService')}>
            <span className="block">{nextServiceText(vehicle)}</span>
            <ServiceStateBadge state={vehicle.serviceState} />
          </Field>
          <Field label={t('fleet.consumption')}>{formatConsumption(vehicle.consumption)}</Field>
          <Field label={t('fleet.driverSinceLabel')}>{formatDate(vehicle.driver?.since)}</Field>
          <Field label={t('fleet.fuelType')}>{t(`fleet.fuel.${vehicle.fuelType}`)}</Field>
        </dl>
        <ul className="divide-y rounded-md border text-sm">
          {vehicle.documents
            .filter((doc) => doc.endDate)
            .map((doc) => (
              <li key={doc.type} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  {t(`fleet.documentTypes.${doc.type}`)}
                  <span className="text-muted-foreground ml-2 text-xs">
                    {formatDate(doc.endDate)}
                  </span>
                </span>
                <DocumentStateBadge doc={doc} />
              </li>
            ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {active && (
            <>
              <Button onClick={() => setDialog('fuel')}>
                <Fuel /> {t('fleet.addFuel')}
              </Button>
              <Button variant="outline" onClick={() => setDialog('reading')}>
                <Gauge /> {t('fleet.addReading')}
              </Button>
            </>
          )}
          <Button variant="ghost" asChild>
            <Link to="/fleet/$id" params={{ id: vehicle.id }}>
              {t('fleet.my.details')} <ChevronRight />
            </Link>
          </Button>
        </div>
      </CardContent>
      <FuelDialog
        vehicle={vehicle}
        open={dialog === 'fuel'}
        onOpenChange={(open) => setDialog(open ? 'fuel' : null)}
      />
      <ReadingDialog
        vehicle={vehicle}
        open={dialog === 'reading'}
        onOpenChange={(open) => setDialog(open ? 'reading' : null)}
      />
    </Card>
  );
}
