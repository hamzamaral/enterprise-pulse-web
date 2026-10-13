import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useCompetenciesFindAll,
  useReviewCyclesCreate,
  useReviewCyclesUpdate,
} from '@/api/generated/endpoints/performance/performance';
import type { ReviewCycleDetailDto } from '@/api/generated/model';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { useInvalidatePerformance } from './performance-components';

export function ReviewCycleFormDialog({
  open,
  onOpenChange,
  cycle,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycle?: ReviewCycleDetailDto;
  onSaved?: (cycle: ReviewCycleDetailDto) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <ReviewCycleForm cycle={cycle} onClose={() => onOpenChange(false)} onSaved={onSaved} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function defaults() {
  const year = new Date().getFullYear();
  return {
    periodStart: `${year}-01-01`,
    periodEnd: `${year}-12-31`,
    selfReviewDue: `${year + 1}-01-15`,
    managerReviewDue: `${year + 1}-01-31`,
  };
}

/** Mounted with the dialog, so every opening starts from the cycle (or defaults). */
function ReviewCycleForm({
  cycle,
  onClose,
  onSaved,
}: {
  cycle?: ReviewCycleDetailDto;
  onClose: () => void;
  onSaved?: (cycle: ReviewCycleDetailDto) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidatePerformance();
  const create = useReviewCyclesCreate();
  const update = useReviewCyclesUpdate();
  const { data: competencies } = useCompetenciesFindAll();
  const initial = cycle ?? defaults();
  const launched = !!cycle && cycle.status !== 'DRAFT';
  const [name, setName] = useState(cycle?.name ?? '');
  const [periodStart, setPeriodStart] = useState(initial.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd);
  const [selfReviewDue, setSelfReviewDue] = useState(initial.selfReviewDue);
  const [managerReviewDue, setManagerReviewDue] = useState(initial.managerReviewDue);
  const [goalWeight, setGoalWeight] = useState(String(cycle?.goalWeight ?? 60));
  const [selected, setSelected] = useState<string[]>(cycle?.competencies.map((c) => c.id) ?? []);
  const [submitted, setSubmitted] = useState(false);

  const weight = Number(goalWeight);
  const options = (competencies ?? []).filter((c) => c.isActive || selected.includes(c.id));
  const errors = {
    name: name.trim().length < 2,
    period: !periodStart || !periodEnd || periodEnd < periodStart,
    due: !selfReviewDue || !managerReviewDue || managerReviewDue < selfReviewDue,
    weight: !Number.isInteger(weight) || weight < 0 || weight > 100,
    competencies: weight < 100 && selected.length === 0,
  };
  const valid = !Object.values(errors).some(Boolean);
  const pending = create.isPending || update.isPending;

  const onSuccess = async (saved: ReviewCycleDetailDto) => {
    toast.success(cycle ? t('common.saved') : t('performance.cycles.created'));
    await invalidate();
    onClose();
    onSaved?.(saved);
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    if (launched) {
      update.mutate(
        { id: cycle.id, data: { name: name.trim(), selfReviewDue, managerReviewDue } },
        { onSuccess },
      );
      return;
    }
    const data = {
      name: name.trim(),
      periodStart,
      periodEnd,
      selfReviewDue,
      managerReviewDue,
      goalWeight: weight,
      competencyIds: selected,
    };
    if (cycle) update.mutate({ id: cycle.id, data }, { onSuccess });
    else create.mutate({ data }, { onSuccess });
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => (checked ? [...current, id] : current.filter((v) => v !== id)));

  const dateField = (
    id: string,
    label: string,
    value: string,
    onChange: (value: string) => void,
    invalid: boolean,
    disabled = false,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="date"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={submitted && invalid}
      />
    </div>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{cycle ? cycle.name : t('performance.cycles.new')}</DialogTitle>
        {launched && <DialogDescription>{t('performance.cycles.launchedHint')}</DialogDescription>}
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cycle-name">{t('common.name')}</Label>
          <Input
            id="cycle-name"
            value={name}
            placeholder={t('performance.cycles.namePlaceholder')}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={submitted && errors.name}
          />
        </div>
        {dateField(
          'cycle-start',
          t('performance.cycles.periodStart'),
          periodStart,
          setPeriodStart,
          errors.period,
          launched,
        )}
        {dateField(
          'cycle-end',
          t('performance.cycles.periodEnd'),
          periodEnd,
          setPeriodEnd,
          errors.period,
          launched,
        )}
        {dateField(
          'cycle-self-due',
          t('performance.cycles.selfReviewDue'),
          selfReviewDue,
          setSelfReviewDue,
          errors.due,
        )}
        {dateField(
          'cycle-manager-due',
          t('performance.cycles.managerReviewDue'),
          managerReviewDue,
          setManagerReviewDue,
          errors.due,
        )}
        {submitted && (errors.period || errors.due) && (
          <p className="text-destructive text-xs sm:col-span-2">
            {t('performance.cycles.datesInvalid')}
          </p>
        )}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cycle-weight">{t('performance.cycles.goalWeight')}</Label>
          <div className="flex items-center gap-3">
            <Input
              id="cycle-weight"
              type="number"
              min={0}
              max={100}
              step={5}
              className="w-24"
              value={goalWeight}
              disabled={launched}
              onChange={(e) => setGoalWeight(e.target.value)}
              aria-invalid={submitted && errors.weight}
            />
            <span className="text-muted-foreground text-sm">
              {t('performance.cycles.weightSplit', {
                goals: Number.isFinite(weight) ? weight : 0,
                competencies: Number.isFinite(weight) ? 100 - weight : 100,
              })}
            </span>
          </div>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t('performance.cycles.competencies')}</Label>
          <div className="grid gap-1 rounded-md border p-2 sm:grid-cols-2">
            {options.map((competency) => {
              const id = `cycle-competency-${competency.id}`;
              return (
                <label
                  key={competency.id}
                  htmlFor={id}
                  className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
                >
                  <Checkbox
                    id={id}
                    disabled={launched}
                    checked={selected.includes(competency.id)}
                    onCheckedChange={(checked) => toggle(competency.id, checked === true)}
                  />
                  {competency.name}
                </label>
              );
            })}
            {competencies && !options.length && (
              <p className="text-muted-foreground p-2 text-sm">
                {t('performance.competencies.empty')}
              </p>
            )}
          </div>
          {submitted && errors.competencies && (
            <p className="text-destructive text-xs">
              {t('performance.cycles.competenciesRequired')}
            </p>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {cycle ? t('common.save') : t('common.create')}
        </Button>
      </DialogFooter>
    </>
  );
}
