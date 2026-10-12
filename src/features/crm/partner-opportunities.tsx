import { Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOpportunitiesFindAll } from '@/api/generated/endpoints/crm/crm';
import type { PartnerDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { StageBadge } from './crm-components';
import { OpportunityFormDialog } from './opportunity-form-dialog';

/** Opportunities of a customer on the partner detail page. */
export function PartnerOpportunities({ partner }: { partner: PartnerDto }) {
  const { t } = useTranslation();
  const can = usePermission();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = useOpportunitiesFindAll({
    partnerId: partner.id,
    pageSize: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{t('crm.opportunities.title')}</CardTitle>
        {can('crm:create') && partner.isActive && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus /> {t('crm.opportunities.new')}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : data?.data.length ? (
          data.data.map((o) => (
            <Link
              key={o.id}
              to="/crm/opportunities/$id"
              params={{ id: o.id }}
              className="hover:bg-muted/60 flex items-center justify-between gap-3 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{o.title}</div>
                <div className="text-muted-foreground text-xs">
                  <code>{o.number}</code> · {formatDate(o.expectedCloseDate ?? o.createdAt)}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm tabular-nums">
                  {formatMoney(o.amount, o.currencyCode)}
                </span>
                <StageBadge stage={o.stage} />
              </div>
            </Link>
          ))
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">{t('common.noResults')}</p>
        )}
      </CardContent>
      <OpportunityFormDialog
        open={creating}
        onOpenChange={setCreating}
        partner={{
          id: partner.id,
          code: partner.code,
          title: partner.title,
          currencyCode: partner.currencyCode,
        }}
      />
    </Card>
  );
}
