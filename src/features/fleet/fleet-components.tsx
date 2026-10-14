import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  VehicleDocumentState,
  VehicleDocumentStatusDto,
  VehicleDto,
  VehicleServiceState,
  VehicleStatus,
} from '@/api/generated/model';
import i18n from '@/i18n';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { formatDate, formatQuantity } from '@/shared/lib/format';

const STATUS_TONES: Record<VehicleStatus, Tone> = {
  ACTIVE: 'success',
  IN_SERVICE: 'warning',
  RETIRED: 'neutral',
};

const DOCUMENT_TONES: Record<VehicleDocumentState, Tone> = {
  VALID: 'success',
  EXPIRING: 'warning',
  EXPIRED: 'danger',
  MISSING: 'neutral',
};

const SERVICE_TONES: Record<VehicleServiceState, Tone> = {
  OK: 'success',
  DUE_SOON: 'warning',
  OVERDUE: 'danger',
};

export const REQUIRED_DOCUMENTS = ['INSPECTION', 'TRAFFIC_INSURANCE'];

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`fleet.status.${status}`)}</ToneBadge>;
}

export function DocumentStateBadge({ doc }: { doc: VehicleDocumentStatusDto }) {
  const { t } = useTranslation();
  const tone =
    doc.state === 'MISSING' && REQUIRED_DOCUMENTS.includes(doc.type)
      ? 'danger'
      : DOCUMENT_TONES[doc.state];
  return <ToneBadge tone={tone}>{t(`fleet.documentState.${doc.state}`)}</ToneBadge>;
}

export function ServiceStateBadge({ state }: { state: VehicleServiceState | null }) {
  const { t } = useTranslation();
  if (!state) return <span className="text-muted-foreground text-xs">—</span>;
  return <ToneBadge tone={SERVICE_TONES[state]}>{t(`fleet.serviceState.${state}`)}</ToneBadge>;
}

/** Red alert and amber warning counts of a vehicle. */
export function AttentionBadges({ vehicle }: { vehicle: VehicleDto }) {
  const { t } = useTranslation();
  if (!vehicle.alertCount && !vehicle.warningCount) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      {vehicle.alertCount > 0 && (
        <span
          className="text-destructive inline-flex items-center gap-1"
          title={t('fleet.alerts', { count: vehicle.alertCount })}
        >
          <CircleAlert className="size-3.5" /> {vehicle.alertCount}
        </span>
      )}
      {vehicle.warningCount > 0 && (
        <span
          className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"
          title={t('fleet.warnings', { count: vehicle.warningCount })}
        >
          <AlertTriangle className="size-3.5" /> {vehicle.warningCount}
        </span>
      )}
    </span>
  );
}

export const formatKm = (value: number | string | null | undefined) => formatQuantity(value, 'km');

export const formatLiters = (value: number | string | null | undefined) =>
  formatQuantity(value === null || value === undefined ? value : Number(value).toFixed(2), 'L');

/** "6,20 L/100 km" */
export const formatConsumption = (value: string | null | undefined) =>
  value
    ? `${new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(value))} L/100 km`
    : '—';

/** Next service as "60.000 km · 31.10.2026". */
export function nextServiceText(vehicle: {
  nextServiceKm: number | null;
  nextServiceDate: string | null;
}) {
  const parts = [
    vehicle.nextServiceKm !== null ? formatKm(vehicle.nextServiceKm) : null,
    vehicle.nextServiceDate ? formatDate(vehicle.nextServiceDate) : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

/** Today as YYYY-MM-DD in the browser's time zone. */
export const localToday = () => new Date().toLocaleDateString('en-CA');

/** "34 ABC 123 · Renault Megane" */
export const vehicleLabel = (vehicle: { plate: string; brand: string; model: string }) =>
  `${vehicle.plate} · ${vehicle.brand} ${vehicle.model}`;

export function useInvalidateFleet() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return (
          typeof key === 'string' &&
          ['vehicles', 'fuel-entries'].some((path) => key.startsWith(`/api/v1/${path}`))
        );
      },
    });
}
