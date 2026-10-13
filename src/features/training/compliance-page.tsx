import { Link } from '@tanstack/react-router';
import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTrainingsCompliance } from '@/api/generated/endpoints/training/training';
import type { ComplianceItemDto } from '@/api/generated/model';
import { KpiCard } from '@/features/reports/report-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { ComplianceBadge, ComplianceCell, formatDecimal } from './training-components';

const ALL = '__all__';
const ISSUES = '__issues__';

const needsAction = (item: ComplianceItemDto) => item.status !== 'VALID';

export function CompliancePage() {
  const { t } = useTranslation();
  const { data, isLoading } = useTrainingsCompliance();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [department, setDepartment] = useState(ALL);

  const totals = useMemo(
    () =>
      (data?.courses ?? []).reduce(
        (sum, c) => ({
          valid: sum.valid + c.valid,
          expiring: sum.expiring + c.expiring,
          expired: sum.expired + c.expired,
          missing: sum.missing + c.missing,
        }),
        { valid: 0, expiring: 0, expired: 0, missing: 0 },
      ),
    [data],
  );

  const departments = useMemo(
    () =>
      [...new Set((data?.employees ?? []).map((e) => e.departmentName).filter(Boolean))]
        .map(String)
        .sort((a, b) => a.localeCompare(b, 'tr')),
    [data],
  );

  const employees = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    return (data?.employees ?? []).filter(
      (e) =>
        (department === ALL || e.departmentName === department) &&
        (filter === ALL || e.items.some(needsAction)) &&
        (!term ||
          [e.employeeName, e.employeeNo].some((v) => v.toLocaleLowerCase('tr').includes(term))),
    );
  }, [data, search, filter, department]);

  const handleExport = async (format: ExportFormat) => {
    if (!data) return;
    const cell = (item: ComplianceItemDto) => {
      const status = t(`training.compliance.status.${item.status}`);
      const date = item.expiresAt ?? item.scheduledAt;
      return date ? `${status} (${formatDate(date)})` : status;
    };
    await exportTable(
      format,
      'training-compliance',
      [
        { header: t('employees.employeeNo'), value: (r) => r.employeeNo },
        { header: t('employees.employee'), value: (r) => r.employeeName },
        { header: t('employees.department'), value: (r) => r.departmentName },
        ...data.courses.map((course, index) => ({
          header: course.code,
          value: (r: (typeof employees)[number]) => cell(r.items[index]),
        })),
      ],
      employees,
    );
  };

  return (
    <>
      <Link
        to="/training"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('training.sessions.title')}
      </Link>
      <PageHeader
        title={t('training.compliance.title')}
        description={t('training.compliance.subtitle')}
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t('training.summary.complianceRate')}
          value={data && (data.rate === null ? '—' : `%${formatDecimal(data.rate)}`)}
          tone={
            data && data.rate !== null ? (data.rate >= 90 ? 'positive' : 'negative') : undefined
          }
          hint={data && t('training.compliance.coursesCount', { count: data.courses.length })}
        />
        <KpiCard
          label={t('training.compliance.status.VALID')}
          value={data && totals.valid}
          hint={t('training.compliance.validHint')}
        />
        <KpiCard
          label={t('training.compliance.status.EXPIRING')}
          value={data && totals.expiring}
          hint={t('training.compliance.expiringHint')}
        />
        <KpiCard
          label={t('training.compliance.overdue')}
          value={data && totals.expired + totals.missing}
          tone={totals.expired + totals.missing > 0 ? 'negative' : undefined}
          hint={
            data &&
            t('training.compliance.overdueHint', {
              expired: totals.expired,
              missing: totals.missing,
            })
          }
        />
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">{t('training.compliance.byCourse')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('training.course')}</TableHead>
                  <TableHead>{t('training.courses.validity')}</TableHead>
                  {(['VALID', 'EXPIRING', 'EXPIRED', 'MISSING'] as const).map((status) => (
                    <TableHead key={status} className="text-right">
                      <ComplianceBadge status={status} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.courses.map((course) => (
                  <TableRow key={course.courseId}>
                    <TableCell>
                      <span className="font-medium">{course.title}</span>
                      <code className="text-muted-foreground ml-2 text-xs">{course.code}</code>
                    </TableCell>
                    <TableCell>
                      {course.validityMonths
                        ? t('training.courses.validityValue', { count: course.validityMonths })
                        : t('training.courses.noExpiry')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{course.valid}</TableCell>
                    <TableCell className="text-right tabular-nums">{course.expiring}</TableCell>
                    <TableCell className="text-right tabular-nums">{course.expired}</TableCell>
                    <TableCell className="text-right tabular-nums">{course.missing}</TableCell>
                  </TableRow>
                ))}
                {data && !data.courses.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground text-center">
                      {t('training.compliance.noCourses')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {!!data?.courses.length && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('training.compliance.matrix')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="pl-8"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-48" aria-label={t('common.status')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('training.compliance.allEmployees')}</SelectItem>
                  <SelectItem value={ISSUES}>{t('training.compliance.needsAction')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger className="w-48" aria-label={t('employees.department')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('performance.cycles.allDepartments')}</SelectItem>
                  {departments.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="ml-auto">
                <ExportMenu size="sm" onExport={handleExport} />
              </div>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="bg-background sticky left-0 min-w-52">
                      {t('employees.employee')}
                    </TableHead>
                    {data.courses.map((course) => (
                      <TableHead key={course.courseId} className="min-w-32" title={course.title}>
                        {course.code}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.employeeId}>
                      <TableCell className="bg-background sticky left-0">
                        <span className="font-medium">{employee.employeeName}</span>
                        <span className="text-muted-foreground block text-xs">
                          {employee.departmentName ?? employee.employeeNo}
                        </span>
                      </TableCell>
                      {employee.items.map((item) => (
                        <TableCell key={item.courseId}>
                          <ComplianceCell item={item} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!employees.length && (
                    <TableRow>
                      <TableCell
                        colSpan={data.courses.length + 1}
                        className="text-muted-foreground text-center"
                      >
                        {t('common.noResults')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
