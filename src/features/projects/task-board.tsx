import { useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getProjectsTasksOfQueryKey,
  useProjectsTasksOf,
  useProjectTasksMove,
} from '@/api/generated/endpoints/projects/projects';
import type { ProjectDetailDto, ProjectTaskDto, ProjectTaskStatus } from '@/api/generated/model';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  PriorityIcon,
  TASK_STATUSES,
  TaskStatusBadge,
  useFormatHours,
  useInvalidateProjects,
} from './project-components';
import { TaskFormDialog } from './task-form-dialog';

const DRAG_TYPE = 'application/x-project-task';

interface DropTarget {
  status: ProjectTaskStatus;
  /** Insert before this card; null appends to the column. */
  beforeId: string | null;
}

/** Kanban of a project's tasks; members drag cards between and within columns. */
export function TaskBoard({ project, canWork }: { project: ProjectDetailDto; canWork: boolean }) {
  const { t } = useTranslation();
  const hours = useFormatHours();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProjects();
  const { data: tasks } = useProjectsTasksOf(project.id);
  const move = useProjectTasksMove();
  const [dragging, setDragging] = useState<ProjectTaskDto | null>(null);
  const [target, setTarget] = useState<DropTarget | null>(null);
  const [editor, setEditor] = useState<{
    open: boolean;
    task: ProjectTaskDto | null;
    status?: ProjectTaskStatus;
  }>({ open: false, task: null });

  if (!tasks) {
    return (
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {TASK_STATUSES.map((status) => (
          <Skeleton key={status} className="h-72" />
        ))}
      </div>
    );
  }

  const columns = TASK_STATUSES.map((status) => ({
    status,
    items: tasks.filter((task) => task.status === status),
  }));

  const drop = (event: DragEvent) => {
    event.preventDefault();
    const card = dragging;
    const to = target;
    setDragging(null);
    setTarget(null);
    if (!card || !to || card.id === to.beforeId) return;
    const rest = tasks.filter((task) => task.status === to.status && task.id !== card.id);
    const index = to.beforeId ? rest.findIndex((task) => task.id === to.beforeId) : rest.length;
    const position = index < 0 ? rest.length : index;
    const current = tasks.filter((task) => task.status === card.status);
    if (card.status === to.status && current.indexOf(card) === position) return;

    const moved = { ...card, status: to.status };
    const column = [...rest.slice(0, position), moved, ...rest.slice(position)];
    const others = tasks.filter((task) => task.status !== to.status && task.id !== card.id);
    queryClient.setQueryData<ProjectTaskDto[]>(getProjectsTasksOfQueryKey(project.id), [
      ...others,
      ...column.map((task, sortOrder) => ({ ...task, sortOrder })),
    ]);
    move.mutate(
      { id: card.id, data: { status: to.status, position } },
      { onSettled: () => void invalidate() },
    );
  };

  const over = (event: DragEvent, next: DropTarget) => {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (target?.status !== next.status || target.beforeId !== next.beforeId) setTarget(next);
  };

  return (
    <>
      <div className="-mx-1 overflow-x-auto pb-2">
        <div className="grid min-w-[960px] grid-cols-4 gap-3 px-1">
          {columns.map((column) => (
            <section
              key={column.status}
              aria-label={t(`projects.taskStatus.${column.status}`)}
              onDragOver={(event) => over(event, { status: column.status, beforeId: null })}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setTarget((current) => (current?.status === column.status ? null : current));
                }
              }}
              onDrop={drop}
              className={cn(
                'bg-muted/40 flex min-h-80 flex-col rounded-lg border p-2 transition-colors',
                target?.status === column.status && 'border-primary bg-primary/5',
              )}
            >
              <header className="mb-2 flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <TaskStatusBadge status={column.status} />
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {column.items.length}
                  </span>
                </div>
                {canWork && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={t('projects.tasks.new')}
                    onClick={() => setEditor({ open: true, task: null, status: column.status })}
                  >
                    <Plus />
                  </Button>
                )}
              </header>
              <div className="flex flex-1 flex-col gap-2">
                {column.items.map((task) => (
                  <div key={task.id}>
                    {target?.beforeId === task.id && dragging?.id !== task.id && (
                      <div className="bg-primary mb-2 h-0.5 rounded-full" />
                    )}
                    <button
                      type="button"
                      draggable={canWork}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_TYPE, task.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging(task);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setTarget(null);
                      }}
                      onDragOver={(event) =>
                        over(event, { status: column.status, beforeId: task.id })
                      }
                      onClick={() => setEditor({ open: true, task })}
                      className={cn(
                        'bg-card hover:border-primary/50 block w-full space-y-2 rounded-md border p-3 text-left shadow-xs transition-colors',
                        canWork && 'cursor-grab active:cursor-grabbing',
                        dragging?.id === task.id && 'opacity-50',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <PriorityIcon priority={task.priority} />
                        <span className="line-clamp-3 flex-1 text-sm font-medium">
                          <span className="text-muted-foreground mr-1 font-mono text-xs">
                            #{task.taskNo}
                          </span>
                          {task.title}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">
                          {task.assigneeName ?? t('projects.tasks.unassigned')}
                        </span>
                        {task.dueDate && (
                          <span
                            className={cn(
                              'shrink-0 tabular-nums',
                              task.overdue && 'text-destructive font-medium',
                            )}
                            title={task.overdue ? t('projects.overdue') : undefined}
                          >
                            {formatDate(task.dueDate)}
                          </span>
                        )}
                      </div>
                      {(Number(task.loggedHours) > 0 || task.estimatedHours) && (
                        <div className="text-muted-foreground text-xs tabular-nums">
                          {hours(task.loggedHours)}
                          {task.estimatedHours && ` / ${hours(task.estimatedHours)}`}
                        </div>
                      )}
                    </button>
                  </div>
                ))}
                {target?.status === column.status && target.beforeId === null && (
                  <div className="bg-primary h-0.5 rounded-full" />
                )}
                {!column.items.length && (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    {t('projects.tasks.empty')}
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <TaskFormDialog
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        project={project}
        task={editor.task}
        status={editor.status}
        readOnly={!canWork}
      />
    </>
  );
}
