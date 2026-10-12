import {
  CalendarClock,
  ListTodo,
  Loader2,
  Mail,
  Phone,
  StickyNote,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCrmMembers } from '@/api/generated/endpoints/crm/crm';
import { useSettingsFindCurrencies } from '@/api/generated/endpoints/settings/settings';
import type { CrmActivityType, LeadStatus, OpportunityStage } from '@/api/generated/model';
import type { SelectOption } from '@/shared/components/simple-form-dialog';
import { ToneBadge, type Tone } from '@/shared/components/status-badge';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Textarea } from '@/shared/ui/textarea';

export const OPEN_STAGES: OpportunityStage[] = [
  'PROSPECTING',
  'QUALIFICATION',
  'PROPOSAL',
  'NEGOTIATION',
];
export const ALL_STAGES: OpportunityStage[] = [...OPEN_STAGES, 'WON', 'LOST'];
export const isOpenStage = (stage: OpportunityStage) => OPEN_STAGES.includes(stage);

const LEAD_TONES: Record<LeadStatus, Tone> = {
  NEW: 'info',
  CONTACTED: 'warning',
  QUALIFIED: 'success',
  DISQUALIFIED: 'neutral',
  CONVERTED: 'success',
};

const STAGE_TONES: Record<OpportunityStage, Tone> = {
  PROSPECTING: 'neutral',
  QUALIFICATION: 'info',
  PROPOSAL: 'warning',
  NEGOTIATION: 'warning',
  WON: 'success',
  LOST: 'danger',
};

export const ACTIVITY_ICONS: Record<CrmActivityType, LucideIcon> = {
  CALL: Phone,
  MEETING: Users,
  EMAIL: Mail,
  TASK: ListTodo,
  NOTE: StickyNote,
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const { t } = useTranslation();
  return <ToneBadge tone={LEAD_TONES[status]}>{t(`crm.leads.statuses.${status}`)}</ToneBadge>;
}

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  const { t } = useTranslation();
  return <ToneBadge tone={STAGE_TONES[stage]}>{t(`crm.opportunities.stages.${stage}`)}</ToneBadge>;
}

/** Thin bar with the percentage next to it. */
export function ProbabilityBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
        <div className="bg-primary h-full rounded-full" style={{ width: `${value}%` }} />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">%{value}</span>
    </div>
  );
}

export function DueText({ value, overdue }: { value: string | null; overdue?: boolean }) {
  const { i18n } = useTranslation();
  if (!value) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs',
        overdue ? 'text-destructive font-medium' : 'text-muted-foreground',
      )}
    >
      <CalendarClock className="size-3" />
      {new Date(value).toLocaleString(i18n.language, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })}
    </span>
  );
}

/** Company users for owner / assignee selects. */
export function useMemberOptions(enabled = true): SelectOption[] {
  const { data } = useCrmMembers({ query: { enabled, staleTime: 5 * 60_000 } });
  return (data ?? []).map((m) => ({ value: m.id, label: m.name }));
}

export function useCurrencyOptions(enabled = true): SelectOption[] {
  const { data } = useSettingsFindCurrencies({ query: { enabled } });
  return (data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.code, label: c.code }));
}

/** ISO timestamp → value for `<input type="datetime-local">` in local time. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  label: string;
  confirmLabel: string;
  pending?: boolean;
  onSubmit: (reason: string) => void;
}

/** Asks for a mandatory reason (disqualify a lead, lose an opportunity). */
export function ReasonDialog({ open, onOpenChange, title, ...body }: ReasonDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ReasonBody {...body} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog content, so the text starts empty on every open. */
function ReasonBody({
  label,
  confirmLabel,
  pending,
  onSubmit,
  onCancel,
}: Pick<ReasonDialogProps, 'label' | 'confirmLabel' | 'pending' | 'onSubmit'> & {
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const valid = reason.trim().length >= 3;
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="reason">{label}</Label>
        <Textarea
          id="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="destructive"
          disabled={!valid || pending}
          onClick={() => onSubmit(reason.trim())}
        >
          {pending && <Loader2 className="animate-spin" />}
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
