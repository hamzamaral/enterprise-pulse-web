import { Link } from '@tanstack/react-router';
import { CalendarClock, Paperclip } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useJobApplicationsMove } from '@/api/generated/endpoints/recruitment/recruitment';
import type { ApplicationStage, JobApplicationDto } from '@/api/generated/model';
import { formatDateTime } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  ACTIVE_STAGES,
  ApplicationStageBadge,
  OfferStatusBadge,
  Rating,
  useInvalidateRecruitment,
} from './recruitment-components';

const DRAG_TYPE = 'application/x-job-application';

/** Kanban of a posting's pipeline; cards are dragged between stages or reordered in a column. */
export function ApplicationBoard({
  applications,
  editable,
}: {
  applications: JobApplicationDto[] | undefined;
  editable: boolean;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateRecruitment();
  const move = useJobApplicationsMove();
  const [dragging, setDragging] = useState<JobApplicationDto | null>(null);
  const [over, setOver] = useState<ApplicationStage | null>(null);

  if (!applications) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {ACTIVE_STAGES.map((stage) => (
          <Skeleton key={stage} className="h-72" />
        ))}
      </div>
    );
  }

  const column = (stage: ApplicationStage) =>
    applications
      .filter((a) => a.stage === stage)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.appliedAt.localeCompare(b.appliedAt));

  const drop = (stage: ApplicationStage, position: number, event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setOver(null);
    const card = dragging;
    setDragging(null);
    if (!card) return;
    const items = column(stage);
    const current = items.findIndex((a) => a.id === card.id);
    if (current === position || (current !== -1 && current + 1 === position)) return;
    const target = current !== -1 && current < position ? position - 1 : position;
    move.mutate(
      { id: card.id, data: { stage, position: target } },
      { onSettled: () => void invalidate() },
    );
  };

  return (
    <div className="-mx-1 overflow-x-auto pb-2">
      <div className="grid min-w-[900px] grid-cols-4 gap-3 px-1">
        {ACTIVE_STAGES.map((stage) => {
          const items = column(stage);
          return (
            <section
              key={stage}
              aria-label={t(`recruitment.stages.${stage}`)}
              onDragOver={(event) => {
                if (!dragging) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOver(stage);
              }}
              onDragLeave={() => setOver((current) => (current === stage ? null : current))}
              onDrop={(event) => drop(stage, items.length, event)}
              className={cn(
                'bg-muted/40 flex min-h-72 flex-col rounded-lg border p-2 transition-colors',
                over === stage && 'border-primary bg-primary/5',
              )}
            >
              <header className="mb-2 flex items-center justify-between gap-2 px-1">
                <ApplicationStageBadge stage={stage} />
                <span className="text-muted-foreground text-xs tabular-nums">{items.length}</span>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {items.map((item, index) => (
                  <Link
                    key={item.id}
                    to="/recruitment/applications/$id"
                    params={{ id: item.id }}
                    draggable={editable}
                    onDragStart={(event) => {
                      if (!editable) return;
                      event.dataTransfer.setData(DRAG_TYPE, item.id);
                      event.dataTransfer.effectAllowed = 'move';
                      setDragging(item);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                    onDragOver={(event) => {
                      if (!dragging) return;
                      event.preventDefault();
                      setOver(stage);
                    }}
                    onDrop={(event) => drop(stage, index, event)}
                    className={cn(
                      'bg-card hover:border-primary/50 block space-y-2 rounded-md border p-3 shadow-xs transition-colors',
                      editable && 'cursor-grab active:cursor-grabbing',
                      dragging?.id === item.id && 'opacity-50',
                    )}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium">{item.candidateName}</span>
                        {item.hasCv && (
                          <Paperclip
                            className="text-muted-foreground size-3.5 shrink-0"
                            aria-label={t('recruitment.candidates.cv')}
                          />
                        )}
                      </div>
                      {item.candidateTitle && (
                        <div className="text-muted-foreground truncate text-xs">
                          {item.candidateTitle}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Rating value={item.rating ?? item.averageRating} />
                      <span className="text-muted-foreground text-xs">
                        {t('recruitment.applications.daysInStage', { count: item.daysInStage })}
                      </span>
                    </div>
                    {(item.nextInterviewAt || item.offerStatus) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {item.nextInterviewAt && (
                          <span className="text-muted-foreground inline-flex items-center gap-1">
                            <CalendarClock className="size-3" />
                            {formatDateTime(item.nextInterviewAt)}
                          </span>
                        )}
                        {item.offerStatus && <OfferStatusBadge status={item.offerStatus} />}
                      </div>
                    )}
                  </Link>
                ))}
                {!items.length && (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    {t('recruitment.applications.emptyColumn')}
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
