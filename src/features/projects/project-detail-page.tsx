import { Link, useNavigate } from '@tanstack/react-router';
import { ArrowLeft, Clock, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useProjectsFindOne, useProjectsRemove } from '@/api/generated/endpoints/projects/projects';
import type { ProjectDetailDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  BudgetBar,
  ProgressBar,
  ProjectStatusBadge,
  TASK_STATUSES,
  TaskStatusBadge,
  WORKING_STATUSES,
  useFormatHours,
  useInvalidateProjects,
} from './project-components';
import { ProjectExpenses } from './project-expenses';
import { ProjectFormDialog } from './project-form-dialog';
import { ProjectMembersCard } from './project-members-card';
import { ProjectTimeEntries } from './project-time-entries';
import { TaskBoard } from './task-board';

export type ProjectTab = 'overview' | 'tasks' | 'time' | 'expenses';

export function ProjectDetailPage({
  id,
  tab,
  onTabChange,
}: {
  id: string;
  tab: ProjectTab;
  onTabChange: (tab: ProjectTab) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateProjects();
  const [editing, setEditing] = useState(false);
  const { data: project, isLoading } = useProjectsFindOne(id);
  const remove = useProjectsRemove();

  if (!project) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const closed = project.status === 'COMPLETED' || project.status === 'CANCELLED';
  const canWork = !closed && (project.canManage || project.isMember);
  const current = tab === 'expenses' && !project.canSeeCosts ? 'overview' : tab;

  const onDelete = () =>
    remove.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('projects.deleted'));
          await invalidate();
          await navigate({ to: '/projects' });
        },
      },
    );

  return (
    <>
      <Link
        to="/projects"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('projects.title')}
      </Link>
      <PageHeader
        title={project.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{project.number}</code>
            <ProjectStatusBadge status={project.status} />
            {project.overdue && (
              <span className="text-destructive text-xs">{t('projects.overdue')}</span>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {project.canLogTime && (
              <Button variant="outline" asChild>
                <Link to="/projects/timesheet">
                  <Clock /> {t('projects.logTime')}
                </Link>
              </Button>
            )}
            {project.canManage && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {project.canDelete && Number(project.loggedHours) === 0 && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={onDelete}
              />
            )}
          </div>
        }
      />

      <Tabs value={current} onValueChange={(value) => onTabChange(value as ProjectTab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview">{t('projects.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="tasks">
            {t('projects.tabs.tasks')} ({project.taskCount})
          </TabsTrigger>
          <TabsTrigger value="time">{t('projects.tabs.time')}</TabsTrigger>
          {project.canSeeCosts && (
            <TabsTrigger value="expenses">{t('projects.tabs.expenses')}</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="overview">
          <Overview project={project} />
        </TabsContent>
        <TabsContent value="tasks">
          <TaskBoard project={project} canWork={canWork} />
        </TabsContent>
        <TabsContent value="time">
          <ProjectTimeEntries project={project} />
        </TabsContent>
        {project.canSeeCosts && (
          <TabsContent value="expenses">
            <ProjectExpenses project={project} />
          </TabsContent>
        )}
      </Tabs>

      {project.canManage && (
        <ProjectFormDialog open={editing} onOpenChange={setEditing} project={project} />
      )}
    </>
  );
}

function Overview({ project }: { project: ProjectDetailDto }) {
  const { t } = useTranslation();
  const can = usePermission();
  const hours = useFormatHours();
  const currency = project.currencyCode;
  const remaining =
    project.budgetAmount && project.totalCost
      ? Number(project.budgetAmount) - Number(project.totalCost)
      : null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('projects.customer')}>
                {project.partnerId && can('partners:read') ? (
                  <Link
                    to="/partners/$id"
                    params={{ id: project.partnerId }}
                    className="text-primary hover:underline"
                  >
                    {project.partnerTitle}
                  </Link>
                ) : (
                  (project.partnerTitle ?? t('projects.internal'))
                )}
              </Field>
              <Field label={t('projects.manager')}>{project.managerName}</Field>
              <Field label={t('projects.progress')}>
                <ProgressBar value={project.progress} />
              </Field>
              <Field label={t('projects.startDate')}>{formatDate(project.startDate)}</Field>
              <Field label={t('projects.dueDate')}>
                <span className={cn(project.overdue && 'text-destructive font-medium')}>
                  {formatDate(project.dueDate)}
                </span>
              </Field>
              {project.completedAt ? (
                <Field label={t('projects.completedAt')}>
                  {formatDateTime(project.completedAt)}
                </Field>
              ) : (
                <Field label={t('projects.acceptsTime')}>
                  {WORKING_STATUSES.includes(project.status) ? t('common.yes') : t('common.no')}
                </Field>
              )}
              <Field label={t('sales.orders.createdBy')}>{project.createdByName}</Field>
              <Field label={t('common.createdAt')}>{formatDate(project.createdAt)}</Field>
              {project.description && (
                <div className="sm:col-span-3">
                  <Field label={t('common.description')}>
                    <span className="whitespace-pre-line">{project.description}</span>
                  </Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <ProjectMembersCard project={project} />
      </div>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('projects.workload')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-2">
              {TASK_STATUSES.map((status) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <TaskStatusBadge status={status} />
                  <span className="tabular-nums">{project.taskCounts[status]}</span>
                </li>
              ))}
            </ul>
            {project.overdueTaskCount > 0 && (
              <p className="text-destructive text-sm">
                {t('projects.overdueTasks', { count: project.overdueTaskCount })}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-3 border-t pt-3">
              <Field label={t('projects.loggedHours')}>
                <span className="tabular-nums">{hours(project.loggedHours)}</span>
              </Field>
              <Field label={t('projects.estimatedHours')}>
                <span className="tabular-nums">{hours(project.estimatedHours)}</span>
              </Field>
            </dl>
          </CardContent>
        </Card>
        {project.canSeeCosts && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('projects.budgetTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <BudgetBar usage={project.budgetUsage} />
              <dl className="grid grid-cols-2 gap-3">
                <Field label={t('projects.budget')}>
                  <span className="tabular-nums">
                    {formatMoney(project.budgetAmount, currency)}
                  </span>
                </Field>
                <Field label={t('projects.remaining')}>
                  <span
                    className={cn(
                      'tabular-nums',
                      remaining !== null && remaining < 0 && 'text-destructive font-medium',
                    )}
                  >
                    {formatMoney(remaining, currency)}
                  </span>
                </Field>
                <Field label={t('projects.laborCost')}>
                  <span className="tabular-nums">{formatMoney(project.laborCost, currency)}</span>
                </Field>
                <Field label={t('projects.expenseCost')}>
                  <span className="tabular-nums">{formatMoney(project.expenseCost, currency)}</span>
                </Field>
                <div className="col-span-2">
                  <Field label={t('projects.totalCost')}>
                    <span className="font-semibold tabular-nums">
                      {formatMoney(project.totalCost, currency)}
                    </span>
                  </Field>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
