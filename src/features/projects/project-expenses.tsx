import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useProjectsExpenses } from '@/api/generated/endpoints/projects/projects';
import type { ProjectDetailDto } from '@/api/generated/model';
import { ExpenseStatusBadge } from '@/features/expenses/expense-components';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';

/** Submitted expense reports charged to the project; approved and paid ones count as cost. */
export function ProjectExpenses({ project }: { project: ProjectDetailDto }) {
  const { t } = useTranslation();
  const { data } = useProjectsExpenses(project.id);

  if (!data) return <Skeleton className="h-48" />;

  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-muted-foreground mb-3 text-sm">{t('projects.expenses.hint')}</p>
        {data.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('trade.number')}</TableHead>
                <TableHead>{t('expenses.titleField')}</TableHead>
                <TableHead>{t('expenses.employee')}</TableHead>
                <TableHead>{t('expenses.submittedAt')}</TableHead>
                <TableHead className="text-right">{t('expenses.total')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((report) => (
                <TableRow key={report.id}>
                  <TableCell>
                    <Link
                      to="/expenses/$id"
                      params={{ id: report.id }}
                      className="text-primary font-mono text-xs hover:underline"
                    >
                      {report.number}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{report.title}</TableCell>
                  <TableCell>{report.employeeName}</TableCell>
                  <TableCell>{formatDate(report.submittedAt)}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      !report.counted && 'text-muted-foreground',
                    )}
                  >
                    {formatMoney(report.totalAmount, project.currencyCode)}
                  </TableCell>
                  <TableCell>
                    <ExpenseStatusBadge status={report.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t('projects.expenses.empty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
