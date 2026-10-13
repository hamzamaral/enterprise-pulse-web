import { useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingsForEmployee } from '@/api/generated/endpoints/training/training';
import type { MyTrainingDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/badge';
import { EnrollmentStatusBadge, formatHours, formatSessionTime } from './training-components';

/** Training history of one employee on the employee detail page. */
export function EmployeeTrainings({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useTrainingsForEmployee(employeeId);
  const hours = (data ?? [])
    .filter((r) => r.status === 'ATTENDED')
    .reduce((sum, r) => sum + Number(r.durationHours), 0);

  const columns = useMemo<ColumnDef<MyTrainingDto, unknown>[]>(
    () => [
      {
        id: 'course',
        header: t('training.course'),
        cell: ({ row }) => (
          <span>
            <span className="inline-flex items-center gap-2 font-medium">
              {row.original.courseTitle}
              {row.original.isMandatory && (
                <Badge variant="outline" className="text-xs font-normal">
                  {t('training.courses.mandatory')}
                </Badge>
              )}
            </span>
            <span className="text-muted-foreground block text-xs">
              {t(`training.categories.${row.original.category}`)} ·{' '}
              {formatHours(row.original.durationHours)}
            </span>
          </span>
        ),
      },
      {
        id: 'when',
        header: t('training.sessions.when'),
        cell: ({ row }) => formatSessionTime(row.original.startsAt, row.original.endsAt),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <EnrollmentStatusBadge status={row.original.status} />,
      },
      {
        id: 'score',
        header: t('training.sessions.score'),
        cell: ({ row }) => <span className="tabular-nums">{row.original.score ?? '—'}</span>,
      },
      {
        id: 'certificate',
        header: t('training.sessions.certificateExpires'),
        cell: ({ row }) =>
          row.original.status === 'ATTENDED'
            ? row.original.certificateExpiresAt
              ? formatDate(row.original.certificateExpiresAt)
              : t('training.courses.noExpiry')
            : '—',
      },
    ],
    [t],
  );

  return (
    <div className="space-y-2">
      {!!data?.length && (
        <p className="text-muted-foreground text-sm">
          {t('training.employeeHours', { hours: formatHours(hours) })}
        </p>
      )}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        searchable={false}
        onRowClick={(row) =>
          void navigate({ to: '/training/sessions/$id', params: { id: row.sessionId } })
        }
      />
    </div>
  );
}
