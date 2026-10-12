import { Link } from '@tanstack/react-router';
import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardDto, OpportunityDto, OpportunityStage } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Skeleton } from '@/shared/ui/skeleton';
import { isOpenStage, ReasonDialog, StageBadge } from './crm-components';
import { useOpportunityActions } from './use-opportunity-actions';

const DRAG_TYPE = 'application/x-opportunity';

/** Kanban of the pipeline; open cards can be dragged to another stage, WON or LOST. */
export function PipelineBoard({ board }: { board: BoardDto | undefined }) {
  const { t } = useTranslation();
  const can = usePermission();
  const actions = useOpportunityActions();
  const [dragging, setDragging] = useState<OpportunityDto | null>(null);
  const [over, setOver] = useState<OpportunityStage | null>(null);
  const [losing, setLosing] = useState<OpportunityDto | null>(null);
  const draggable = can('crm:update');

  if (!board) {
    return (
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  }

  const canDrop = (stage: OpportunityStage) =>
    !!dragging && dragging.stage !== stage && isOpenStage(dragging.stage);

  const drop = (stage: OpportunityStage, event: DragEvent) => {
    event.preventDefault();
    setOver(null);
    const card = dragging;
    setDragging(null);
    if (!card || card.stage === stage || !isOpenStage(card.stage)) return;
    if (stage === 'WON') actions.win(card);
    else if (stage === 'LOST') setLosing(card);
    else actions.move(card, stage);
  };

  return (
    <>
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3 px-1">
          {board.columns.map((column) => (
            <section
              key={column.stage}
              aria-label={t(`crm.opportunities.stages.${column.stage}`)}
              onDragOver={(event) => {
                if (!canDrop(column.stage)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setOver(column.stage);
              }}
              onDragLeave={() => setOver((current) => (current === column.stage ? null : current))}
              onDrop={(event) => drop(column.stage, event)}
              className={cn(
                'bg-muted/40 flex min-h-72 flex-col rounded-lg border p-2 transition-colors',
                over === column.stage && 'border-primary bg-primary/5',
                dragging &&
                  !canDrop(column.stage) &&
                  dragging.stage !== column.stage &&
                  'opacity-60',
              )}
            >
              <header className="mb-2 space-y-1 px-1">
                <div className="flex items-center justify-between gap-2">
                  <StageBadge stage={column.stage} />
                  <span className="text-muted-foreground text-xs tabular-nums">{column.count}</span>
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  {formatMoney(column.amount, board.currencyCode)}
                </div>
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {column.items.map((item) => {
                  const movable = draggable && isOpenStage(item.stage);
                  return (
                    <Link
                      key={item.id}
                      to="/crm/opportunities/$id"
                      params={{ id: item.id }}
                      draggable={movable}
                      onDragStart={(event) => {
                        if (!movable) return;
                        event.dataTransfer.setData(DRAG_TYPE, item.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging(item);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      className={cn(
                        'bg-card hover:border-primary/50 block space-y-2 rounded-md border p-3 shadow-xs transition-colors',
                        movable && 'cursor-grab active:cursor-grabbing',
                        dragging?.id === item.id && 'opacity-50',
                      )}
                    >
                      <div className="space-y-0.5">
                        <div className="line-clamp-2 text-sm font-medium">{item.title}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {item.partnerTitle}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatMoney(item.amount, item.currencyCode)}
                          </span>
                          {isOpenStage(item.stage) && (
                            <span className="text-muted-foreground text-xs tabular-nums">
                              %{item.probability}
                            </span>
                          )}
                        </div>
                        {isOpenStage(item.stage) && (
                          <div className="bg-muted h-1 overflow-hidden rounded-full">
                            <div
                              className="bg-primary h-full rounded-full"
                              style={{ width: `${item.probability}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{item.ownerName}</span>
                        <span
                          className={cn(
                            'shrink-0 tabular-nums',
                            item.overdue && 'text-destructive font-medium',
                          )}
                          title={item.overdue ? t('crm.opportunities.overdue') : undefined}
                        >
                          {formatDate(
                            isOpenStage(item.stage) ? item.expectedCloseDate : item.closedAt,
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                })}
                {!column.items.length && (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    {t('common.noResults')}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <ReasonDialog
        open={!!losing}
        onOpenChange={(open) => !open && setLosing(null)}
        title={t('crm.opportunities.loseTitle', { number: losing?.number })}
        label={t('crm.opportunities.lostReason')}
        confirmLabel={t('crm.opportunities.lose')}
        pending={actions.pending}
        onSubmit={(reason) => losing && actions.lose(losing, reason, () => setLosing(null))}
      />
    </>
  );
}
