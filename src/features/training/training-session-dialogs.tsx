import { Loader2, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useEmployeesFindAll } from '@/api/generated/endpoints/employees/employees';
import {
  useTrainingSessionsComplete,
  useTrainingSessionsEnroll,
} from '@/api/generated/endpoints/training/training';
import type { TrainingSessionDetailDto } from '@/api/generated/model';
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
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useInvalidateTraining } from './training-components';

interface SessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: TrainingSessionDetailDto;
}

export function AddParticipantsDialog({ open, onOpenChange, session }: SessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <AddParticipantsForm session={session} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function AddParticipantsForm({
  session,
  onClose,
}: {
  session: TrainingSessionDetailDto;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const enroll = useTrainingSessionsEnroll();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const { data } = useEmployeesFindAll({
    pageSize: 100,
    status: 'ACTIVE',
    sortBy: 'firstName',
    sortOrder: 'asc',
  });

  const seated = useMemo(
    () =>
      new Set(session.enrollments.filter((e) => e.status !== 'CANCELLED').map((e) => e.employeeId)),
    [session.enrollments],
  );
  const candidates = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    return (data?.data ?? []).filter(
      (e) =>
        !seated.has(e.id) &&
        (!term ||
          [e.fullName, e.employeeNo, e.departmentName ?? ''].some((v) =>
            v.toLocaleLowerCase('tr').includes(term),
          )),
    );
  }, [data, seated, search]);
  const overCapacity = session.seatsLeft !== null && selected.length > session.seatsLeft;

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => (checked ? [...current, id] : current.filter((v) => v !== id)));

  const submit = () =>
    enroll.mutate(
      { id: session.id, data: { employeeIds: selected } },
      {
        onSuccess: async () => {
          toast.success(t('training.sessions.enrolledToast', { count: selected.length }));
          await invalidate();
          onClose();
        },
      },
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('training.sessions.addParticipants')}</DialogTitle>
        <DialogDescription>
          {session.seatsLeft === null
            ? t('training.sessions.unlimitedSeats')
            : t('training.sessions.seatsLeft', { count: session.seatsLeft })}
        </DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          className="pl-8"
        />
      </div>
      <ScrollArea className="h-72 rounded-md border">
        <div className="p-1">
          {candidates.map((employee) => {
            const id = `participant-${employee.id}`;
            return (
              <label
                key={employee.id}
                htmlFor={id}
                className="hover:bg-muted flex cursor-pointer items-center gap-3 rounded px-2 py-1.5"
              >
                <Checkbox
                  id={id}
                  checked={selected.includes(employee.id)}
                  onCheckedChange={(checked) => toggle(employee.id, checked === true)}
                />
                <span className="flex-1 text-sm">
                  {employee.fullName}
                  <span className="text-muted-foreground block text-xs">
                    {[employee.departmentName, employee.positionName].filter(Boolean).join(' · ') ||
                      employee.employeeNo}
                  </span>
                </span>
              </label>
            );
          })}
          {data && !candidates.length && (
            <p className="text-muted-foreground p-4 text-center text-sm">
              {t('training.sessions.noCandidates')}
            </p>
          )}
        </div>
      </ScrollArea>
      {overCapacity && (
        <p className="text-destructive text-xs">{t('training.sessions.overCapacity')}</p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={!selected.length || overCapacity || enroll.isPending} onClick={submit}>
          {enroll.isPending && <Loader2 className="animate-spin" />}
          {t('training.sessions.enrollSelected', { count: selected.length })}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CompleteSessionDialog({ open, onOpenChange, session }: SessionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open && <CompleteSessionForm session={session} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CompleteSessionForm({
  session,
  onClose,
}: {
  session: TrainingSessionDetailDto;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateTraining();
  const complete = useTrainingSessionsComplete();
  const enrolled = session.enrollments.filter((e) => e.status === 'ENROLLED');
  const [attended, setAttended] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(enrolled.map((e) => [e.id, true])),
  );
  const [scores, setScores] = useState<Record<string, string>>({});

  const invalidScore = Object.values(scores).some((value) => {
    if (value === '') return false;
    const n = Number(value);
    return !Number.isInteger(n) || n < 0 || n > 100;
  });
  const attendedCount = enrolled.filter((e) => attended[e.id]).length;

  const submit = () =>
    complete.mutate(
      {
        id: session.id,
        data: {
          attendance: enrolled.map((e) => ({
            enrollmentId: e.id,
            attended: !!attended[e.id],
            score: attended[e.id] && scores[e.id] ? Number(scores[e.id]) : null,
          })),
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('training.sessions.completedToast'));
          await invalidate();
          onClose();
        },
      },
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('training.sessions.complete')}</DialogTitle>
        <DialogDescription>
          {session.validityMonths
            ? t('training.sessions.completeHintValidity', { count: session.validityMonths })
            : t('training.sessions.completeHint')}
        </DialogDescription>
      </DialogHeader>
      <ScrollArea className="h-80 rounded-md border">
        <div className="divide-y">
          {enrolled.map((e) => {
            const id = `attended-${e.id}`;
            return (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2">
                <Checkbox
                  id={id}
                  checked={!!attended[e.id]}
                  onCheckedChange={(checked) =>
                    setAttended((current) => ({ ...current, [e.id]: checked === true }))
                  }
                />
                <label htmlFor={id} className="flex-1 cursor-pointer text-sm">
                  {e.employeeName}
                  <span className="text-muted-foreground block text-xs">
                    {e.departmentName ?? e.employeeNo}
                  </span>
                </label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 w-24"
                  placeholder={t('training.sessions.score')}
                  aria-label={`${e.employeeName}: ${t('training.sessions.score')}`}
                  disabled={!attended[e.id]}
                  value={scores[e.id] ?? ''}
                  onChange={(event) =>
                    setScores((current) => ({ ...current, [e.id]: event.target.value }))
                  }
                />
              </div>
            );
          })}
          {!enrolled.length && (
            <p className="text-muted-foreground p-4 text-center text-sm">
              {t('training.sessions.noParticipants')}
            </p>
          )}
        </div>
      </ScrollArea>
      <p className="text-muted-foreground text-sm">
        {t('training.sessions.attendanceSummary', {
          attended: attendedCount,
          noShow: enrolled.length - attendedCount,
        })}
      </p>
      {invalidScore && (
        <p className="text-destructive text-xs">{t('training.sessions.scoreInvalid')}</p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={invalidScore || complete.isPending} onClick={submit}>
          {complete.isPending && <Loader2 className="animate-spin" />}
          {t('training.sessions.complete')}
        </Button>
      </DialogFooter>
    </>
  );
}
