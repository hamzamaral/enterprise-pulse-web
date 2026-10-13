import { Loader2, Search } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useInterviewsCreate,
  useInterviewsUpdate,
} from '@/api/generated/endpoints/recruitment/recruitment';
import { InterviewType, type InterviewDto } from '@/api/generated/model';
import { fromLocalInput, toLocalInput } from '@/features/crm/crm-components';
import { useEmployeeOptions } from '@/features/hr/hr-components';
import { Button } from '@/shared/ui/button';
import { Checkbox } from '@/shared/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Textarea } from '@/shared/ui/textarea';
import { useInvalidateRecruitment } from './recruitment-components';

/** Tomorrow 10:00 local time. */
function defaultStart(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return toLocalInput(date.toISOString());
}

export function InterviewFormDialog({
  open,
  onOpenChange,
  applicationId,
  interview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  interview?: InterviewDto;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        {open && (
          <InterviewForm
            applicationId={applicationId}
            interview={interview}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog, so every opening starts from the interview (or defaults). */
function InterviewForm({
  applicationId,
  interview,
  onClose,
}: {
  applicationId: string;
  interview?: InterviewDto;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const create = useInterviewsCreate();
  const update = useInterviewsUpdate();
  const employees = useEmployeeOptions();
  const [type, setType] = useState<InterviewType>(interview?.type ?? 'VIDEO');
  const [scheduledAt, setScheduledAt] = useState(
    interview ? toLocalInput(interview.scheduledAt) : defaultStart(),
  );
  const [duration, setDuration] = useState(String(interview?.durationMinutes ?? 60));
  const [location, setLocation] = useState(interview?.location ?? '');
  const [notes, setNotes] = useState(interview?.notes ?? '');
  const [interviewers, setInterviewers] = useState<string[]>(
    interview?.participants.map((p) => p.employeeId) ?? [],
  );
  const [filter, setFilter] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const minutes = Number(duration);
  const errors = {
    scheduledAt: !scheduledAt,
    duration: !Number.isInteger(minutes) || minutes < 15 || minutes > 480,
    interviewers: interviewers.length < 1 || interviewers.length > 10,
  };
  const valid = !Object.values(errors).some(Boolean);
  const pending = create.isPending || update.isPending;
  const visible = employees.filter((e) =>
    e.label.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()),
  );

  const onSuccess = async () => {
    toast.success(
      interview ? t('recruitment.interviews.updated') : t('recruitment.interviews.scheduled'),
    );
    await invalidate();
    onClose();
  };

  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    const data = {
      type,
      scheduledAt: fromLocalInput(scheduledAt)!,
      durationMinutes: minutes,
      location: location.trim() || null,
      notes: notes.trim() || null,
      interviewerIds: interviewers,
    };
    if (interview) update.mutate({ id: interview.id, data }, { onSuccess });
    else create.mutate({ data: { ...data, applicationId } }, { onSuccess });
  };

  const toggle = (id: string, checked: boolean) =>
    setInterviewers((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id),
    );

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {interview ? t('recruitment.interviews.edit') : t('recruitment.interviews.new')}
        </DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="interview-type">{t('recruitment.interviews.type')}</Label>
          <Select value={type} onValueChange={(value) => setType(value as InterviewType)}>
            <SelectTrigger id="interview-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.values(InterviewType).map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`recruitment.interviewTypes.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-at">{t('recruitment.interviews.scheduledAt')}</Label>
          <Input
            id="interview-at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            aria-invalid={submitted && errors.scheduledAt}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-duration">{t('recruitment.interviews.duration')}</Label>
          <Input
            id="interview-duration"
            type="number"
            min={15}
            max={480}
            step={15}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            aria-invalid={submitted && errors.duration}
          />
          {submitted && errors.duration && (
            <p className="text-destructive text-xs">{t('recruitment.interviews.durationRange')}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="interview-location">{t('recruitment.interviews.location')}</Label>
          <Input
            id="interview-location"
            value={location}
            placeholder={t('recruitment.interviews.locationHint')}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>
            {t('recruitment.interviews.interviewers')}{' '}
            <span className="text-muted-foreground text-xs font-normal">
              ({t('recruitment.interviews.selectedCount', { count: interviewers.length })})
            </span>
          </Label>
          <div className="relative">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('common.search')}
              aria-label={t('recruitment.interviews.searchInterviewers')}
              className="pl-8"
            />
          </div>
          <ScrollArea className="h-40 rounded-md border">
            <div className="space-y-1 p-2">
              {visible.map((employee) => {
                const id = `interviewer-${employee.value}`;
                return (
                  <label
                    key={employee.value}
                    htmlFor={id}
                    className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
                  >
                    <Checkbox
                      id={id}
                      checked={interviewers.includes(employee.value)}
                      onCheckedChange={(checked) => toggle(employee.value, checked === true)}
                    />
                    {employee.label}
                  </label>
                );
              })}
            </div>
          </ScrollArea>
          {submitted && errors.interviewers && (
            <p className="text-destructive text-xs">
              {t('recruitment.interviews.interviewersRequired')}
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="interview-notes">{t('common.notes')}</Label>
          <Textarea
            id="interview-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button disabled={pending} onClick={submit}>
          {pending && <Loader2 className="animate-spin" />}
          {interview ? t('common.save') : t('recruitment.interviews.schedule')}
        </Button>
      </DialogFooter>
    </>
  );
}
