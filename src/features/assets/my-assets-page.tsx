import { Link } from '@tanstack/react-router';
import { FileText, PackageOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAssetAssignmentsFindMine } from '@/api/generated/endpoints/assets/assets';
import { PageHeader } from '@/shared/components/page-header';
import { ToneBadge } from '@/shared/components/status-badge';
import { formatDate } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { AssignmentsTable } from './assignments-table';

export function MyAssetsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useAssetAssignmentsFindMine();
  const active = data?.filter((a) => a.status === 'ACTIVE') ?? [];
  const past = data?.filter((a) => a.status === 'RETURNED') ?? [];

  return (
    <>
      <PageHeader title={t('assets.myTitle')} description={t('assets.mySubtitle')} />
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !active.length ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-sm">
            <PackageOpen className="size-8" />
            {t('assets.noAssets')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((assignment) => (
            <Card key={assignment.id}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{assignment.assetName}</div>
                    <code className="text-muted-foreground text-xs">{assignment.assetTag}</code>
                  </div>
                  {assignment.acknowledgedAt ? (
                    <ToneBadge tone="success">{t('assets.acknowledged')}</ToneBadge>
                  ) : (
                    <ToneBadge tone="warning">{t('assets.awaitingAcknowledgement')}</ToneBadge>
                  )}
                </div>
                <dl className="text-muted-foreground grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt>{t('assets.assignedAt')}</dt>
                    <dd className="text-foreground text-sm">{formatDate(assignment.assignedAt)}</dd>
                  </div>
                  <div>
                    <dt>{t('assets.expectedReturnDate')}</dt>
                    <dd className="text-foreground text-sm">
                      {formatDate(assignment.expectedReturnDate)}
                    </dd>
                  </div>
                </dl>
                <Button
                  asChild
                  size="sm"
                  variant={assignment.acknowledgedAt ? 'outline' : 'default'}
                  className="mt-auto"
                >
                  <Link to="/assets/assignments/$id" params={{ id: assignment.id }}>
                    <FileText />
                    {assignment.acknowledgedAt
                      ? t('assets.viewDocument')
                      : t('assets.reviewAndSign')}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <section className="mt-8 space-y-3">
          <h2 className="text-lg font-medium">{t('assets.pastAssignments')}</h2>
          <AssignmentsTable data={past} isLoading={false} hideAssignee />
        </section>
      )}
    </>
  );
}
