import { Building, MapPin, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useAssetCategoriesFindAll,
  useAssetLocationsFindAll,
} from '@/api/generated/endpoints/assets/assets';
import type {
  AssetCondition,
  AssetStatus,
  AssigneeType,
  AssignmentStatus,
} from '@/api/generated/model';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';

const STATUS_TONES: Record<AssetStatus, Tone> = {
  IN_STOCK: 'success',
  ASSIGNED: 'info',
  IN_MAINTENANCE: 'warning',
  RETIRED: 'neutral',
  LOST: 'danger',
};

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STATUS_TONES[status]}>{t(`assets.status.${status}`)}</ToneBadge>;
}

const CONDITION_TONES: Record<AssetCondition, Tone> = {
  NEW: 'success',
  GOOD: 'info',
  FAIR: 'warning',
  DAMAGED: 'danger',
};

export function ConditionBadge({ condition }: { condition: AssetCondition }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={CONDITION_TONES[condition]}>{t(`assets.conditions.${condition}`)}</ToneBadge>
  );
}

export function AssignmentStatusBadge({ status }: { status: AssignmentStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={status === 'ACTIVE' ? 'info' : 'neutral'}>
      {t(`assets.assignmentStatus.${status}`)}
    </ToneBadge>
  );
}

const ASSIGNEE_ICONS: Record<AssigneeType, typeof User> = {
  EMPLOYEE: User,
  DEPARTMENT: Building,
  LOCATION: MapPin,
};

export function Assignee({ type, name }: { type: AssigneeType; name: string }) {
  const Icon = ASSIGNEE_ICONS[type];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="text-muted-foreground size-3.5 shrink-0" />
      {name}
    </span>
  );
}

export function useCategoryOptions(enabled = true): SelectOption[] {
  const { data } = useAssetCategoriesFindAll({ query: { enabled } });
  return (data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }));
}

export function useLocationOptions(enabled = true): SelectOption[] {
  const { data } = useAssetLocationsFindAll({ query: { enabled } });
  return (data ?? []).filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }));
}

export const today = () => new Date().toISOString().slice(0, 10);
