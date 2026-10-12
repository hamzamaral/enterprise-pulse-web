import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useProjectTasksMine } from '@/api/generated/endpoints/projects/projects';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { PriorityIcon, TaskStatusBadge, useFormatHours } from './project-components';

/** Open tasks assigned to the current user, soonest due first. */
export function MyTasksPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hours = useFormatHours();
  const { data: tasks } = useProjectTasksMine();

  return (
    <>
      <PageHeader
        title={t('projects.myTasks.title')}
        description={t('projects.myTasks.subtitle')}
      />
      <Card>
        <CardContent className="pt-6">
          {!tasks ? (
            <Skeleton className="h-48" />
          ) : tasks.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('projects.tasks.title')}</TableHead>
                  <TableHead>{t('projects.project')}</TableHead>
                  <TableHead>{t('projects.tasks.priority')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('projects.dueDate')}</TableHead>
                  <TableHead className="text-right">{t('projects.loggedHours')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer"
                    onClick={() =>
                      void navigate({
                        to: '/projects/$id',
                        params: { id: task.projectId },
                        search: { tab: 'tasks' },
                      })
                    }
                  >
                    <TableCell className="font-medium">
                      <span className="text-muted-foreground mr-1 font-mono text-xs">
                        #{task.taskNo}
                      </span>
                      {task.title}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{task.projectNumber}</code>
                      <div className="text-muted-foreground text-xs">{task.projectName}</div>
                    </TableCell>
                    <TableCell>
                      <PriorityIcon priority={task.priority} withLabel />
                    </TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell className={cn(task.overdue && 'text-destructive font-medium')}>
                      {formatDate(task.dueDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {hours(task.loggedHours)}
                      {task.estimatedHours && (
                        <span className="text-muted-foreground">
                          {' '}
                          / {hours(task.estimatedHours)}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              {t('projects.myTasks.empty')}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
