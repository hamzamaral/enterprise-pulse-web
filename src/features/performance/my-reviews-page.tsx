import { Link, useNavigate } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { CalendarClock, CheckCircle2, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  usePerformanceReviewsMine,
  usePerformanceReviewsTeam,
} from '@/api/generated/endpoints/performance/performance';
import type { PerformanceReviewDto } from '@/api/generated/model';
import { DataTable } from '@/shared/components/data-table/data-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate } from '@/shared/lib/format';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ReviewStatusBadge, ScoreBadge } from './performance-components';

/** The deadline that matters for the current step of the review. */
function nextDue(review: PerformanceReviewDto) {
  if (review.cycleStatus !== 'ACTIVE' || review.status === 'COMPLETED') return null;
  return review.status === 'SELF_REVIEW' ? review.selfReviewDue : review.managerReviewDue;
}

export function MyReviewsPage() {
  const { t } = useTranslation();
  const { data: mine, isLoading } = usePerformanceReviewsMine();
  const { data: team } = usePerformanceReviewsTeam();
  const waiting = team?.filter((r) => r.cycleStatus === 'ACTIVE' && r.status === 'MANAGER_REVIEW');

  return (
    <>
      <PageHeader title={t('performance.my.title')} description={t('performance.my.subtitle')} />
      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">{t('performance.my.mine')}</TabsTrigger>
          {!!team?.length && (
            <TabsTrigger value="team">
              {t('performance.my.team')}
              {!!waiting?.length && (
                <span className="bg-primary text-primary-foreground ml-1 rounded-full px-1.5 text-xs tabular-nums">
                  {waiting.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="mine" className="space-y-3">
          {isLoading && <Skeleton className="h-24" />}
          {mine?.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center text-sm">
                {t('performance.my.empty')}
              </CardContent>
            </Card>
          )}
          {mine?.map((review) => (
            <MyReviewCard key={review.id} review={review} />
          ))}
        </TabsContent>
        {!!team?.length && (
          <TabsContent value="team">
            <TeamTable rows={team} />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function MyReviewCard({ review }: { review: PerformanceReviewDto }) {
  const { t } = useTranslation();
  const due = nextDue(review);
  const [now] = useState(() => Date.now());
  const overdue = !!due && new Date(`${due}T23:59:59`).getTime() < now;
  const action =
    review.cycleStatus === 'ACTIVE' && review.status === 'SELF_REVIEW'
      ? t('performance.my.fillSelf')
      : review.status === 'COMPLETED' && !review.acknowledgedAt
        ? t('performance.my.acknowledgeHint')
        : null;
  return (
    <Link to="/performance/reviews/$id" params={{ id: review.id }} className="block">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="min-w-48 flex-1">
            <div className="font-medium">{review.cycleName}</div>
            <div className="text-muted-foreground text-xs">
              {formatDate(review.periodStart)} – {formatDate(review.periodEnd)}
              {review.reviewerName &&
                ` · ${t('performance.reviews.reviewer')}: ${review.reviewerName}`}
            </div>
            {action && <div className="text-primary mt-1 text-sm">{action}</div>}
          </div>
          {due && (
            <span
              className={
                overdue
                  ? 'text-destructive inline-flex items-center gap-1 text-sm'
                  : 'text-muted-foreground inline-flex items-center gap-1 text-sm'
              }
            >
              <CalendarClock className="size-4" /> {formatDate(due)}
            </span>
          )}
          <ReviewStatusBadge status={review.status} />
          {review.acknowledgedAt && (
            <CheckCircle2
              className="size-4 text-emerald-600"
              aria-label={t('performance.reviews.acknowledged')}
            />
          )}
          <ScoreBadge score={review.overallScore} />
          <ChevronRight className="text-muted-foreground size-4" />
        </CardContent>
      </Card>
    </Link>
  );
}

function TeamTable({ rows }: { rows: PerformanceReviewDto[] }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const columns = useMemo<ColumnDef<PerformanceReviewDto, unknown>[]>(
    () => [
      {
        id: 'employee',
        header: t('employees.employee'),
        cell: ({ row }) => (
          <span>
            <span className="font-medium">{row.original.employeeName}</span>
            <span className="text-muted-foreground block text-xs">
              {row.original.positionName ?? row.original.employeeNo}
            </span>
          </span>
        ),
      },
      {
        id: 'cycle',
        header: t('performance.reviews.cycle'),
        cell: ({ row }) => row.original.cycleName,
      },
      {
        id: 'due',
        header: t('performance.reviews.due'),
        cell: ({ row }) => formatDate(nextDue(row.original)),
      },
      {
        id: 'status',
        header: t('common.status'),
        cell: ({ row }) => <ReviewStatusBadge status={row.original.status} />,
      },
      {
        id: 'score',
        header: t('performance.reviews.overallScore'),
        cell: ({ row }) => <ScoreBadge score={row.original.overallScore} />,
      },
    ],
    [t],
  );
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable={false}
      onRowClick={(row) =>
        void navigate({ to: '/performance/reviews/$id', params: { id: row.id } })
      }
    />
  );
}
