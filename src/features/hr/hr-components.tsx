import { useTranslation } from 'react-i18next';
import { useDepartmentsFindAll } from '@/api/generated/endpoints/departments/departments';
import { useEmployeesFindAll } from '@/api/generated/endpoints/employees/employees';
import { usePositionsFindAll } from '@/api/generated/endpoints/positions/positions';
import type { EmployeeStatus, LeaveRequestStatus } from '@/api/generated/model';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';

const LEAVE_TONES: Record<LeaveRequestStatus, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};

export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={LEAVE_TONES[status]}>{t(`leave.status.${status}`)}</ToneBadge>;
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={status === 'ACTIVE' ? 'success' : 'neutral'}>
      {t(`employees.status.${status}`)}
    </ToneBadge>
  );
}

export function ColorDot({ color }: { color: string }) {
  return (
    <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />
  );
}

/** Empty form values ("") become `null` so the API clears the field. */
export const emptyToNull = (value: string | null | undefined) => value || null;

export function useDepartmentOptions(enabled = true): SelectOption[] {
  const { data } = useDepartmentsFindAll({ query: { enabled } });
  return (data ?? []).map((d) => ({ value: d.id, label: d.name }));
}

export function usePositionOptions(enabled = true): SelectOption[] {
  const { data } = usePositionsFindAll(
    { pageSize: 100, sortBy: 'name', sortOrder: 'asc' },
    {
      query: { enabled },
    },
  );
  return (data?.data ?? []).map((p) => ({ value: p.id, label: p.name }));
}

/** Active employees, e.g. for manager pickers. */
export function useEmployeeOptions(enabled = true): SelectOption[] {
  const { data } = useEmployeesFindAll(
    { pageSize: 100, status: 'ACTIVE', sortBy: 'firstName', sortOrder: 'asc' },
    { query: { enabled } },
  );
  return (data?.data ?? []).map((e) => ({ value: e.id, label: e.fullName }));
}
