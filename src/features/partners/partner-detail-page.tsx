import { Link } from '@tanstack/react-router';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePartnersFindOne } from '@/api/generated/endpoints/partners/partners';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { RecordNotFound } from '@/shared/components/route-error';
import { BalanceText, PartnerTypeBadge } from './partner-components';
import { PartnerFormDialog } from './partner-form-dialog';
import { PartnerStatement } from './partner-statement';
import { PartnerOpportunities } from '@/features/crm/partner-opportunities';
import { ActivityTimeline } from '@/features/crm/activity-timeline';
import { PartyContracts } from '@/features/contracts/party-contracts';

export function PartnerDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const [editing, setEditing] = useState(false);
  const { data: partner, isLoading } = usePartnersFindOne(id);

  if (!partner) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const balance = Number(partner.balance);
  const limit = partner.creditLimit === null ? null : Number(partner.creditLimit);

  return (
    <>
      <Link
        to="/partners"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm print:hidden"
      >
        <ArrowLeft className="size-4" /> {t('partners.title')}
      </Link>
      <PageHeader
        title={partner.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{partner.code}</code>
            <PartnerTypeBadge type={partner.type} />
            <ActiveBadge active={partner.isActive} />
          </span>
        }
        actions={
          <Can permission="partners:update">
            <Button variant="outline" onClick={() => setEditing(true)} className="print:hidden">
              <Pencil /> {t('common.edit')}
            </Button>
          </Can>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 print:hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('common.details')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label={t('partners.taxNumber')}>{partner.taxNumber}</Field>
              <Field label={t('partners.taxOffice')}>{partner.taxOffice}</Field>
              <Field label={t('partners.eInvoiceAlias')}>
                {partner.eInvoiceAlias ? (
                  <code className="text-xs break-all">{partner.eInvoiceAlias}</code>
                ) : (
                  <span className="text-muted-foreground">{t('partners.eArchiveOnly')}</span>
                )}
              </Field>
              <Field label={t('partners.contactName')}>{partner.contactName}</Field>
              <Field label={t('common.phone')}>{partner.phone}</Field>
              <Field label={t('common.email')}>{partner.email}</Field>
              <Field label={t('common.city')}>{partner.city}</Field>
              <div className="sm:col-span-3">
                <Field label={t('common.address')}>{partner.address}</Field>
              </div>
              {partner.notes && (
                <div className="sm:col-span-3">
                  <Field label={t('common.notes')}>{partner.notes}</Field>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle className="text-base">{t('partners.account')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-muted-foreground text-xs">{t('partners.balance')}</div>
              <div className="text-2xl font-semibold">
                <BalanceText value={partner.balance} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <Field label={t('partners.paymentTermDays')}>
                {t('partners.days', { count: partner.paymentTermDays })}
              </Field>
              <Field label={t('partners.currency')}>{partner.currencyCode}</Field>
              <Field label={t('partners.creditLimit')}>
                {limit === null ? t('partners.unlimited') : formatMoney(limit)}
              </Field>
              {limit !== null && (
                <Field label={t('partners.availableCredit')}>
                  {formatMoney(Math.max(0, limit - Math.max(0, balance)))}
                </Field>
              )}
            </dl>
          </CardContent>
        </Card>
      </div>

      {(can('partners:read') || can('finance:read')) && (
        <Card className="mt-4 print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle className="text-base">
              {t('statement.title')}
              <span className="text-muted-foreground hidden font-normal print:inline">
                {' '}
                — {partner.code} {partner.title}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PartnerStatement partnerId={partner.id} />
          </CardContent>
        </Card>
      )}

      {can('crm:read') && partner.type !== 'SUPPLIER' && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2 print:hidden">
          <PartnerOpportunities partner={partner} />
          <ActivityTimeline link={{ partnerId: partner.id }} />
        </div>
      )}

      {can('contracts:read') && (
        <div className="mt-4 print:hidden">
          <PartyContracts
            filter={{ partnerId: partner.id }}
            preset={{
              party: 'PARTNER',
              partner: { id: partner.id, code: partner.code, title: partner.title },
            }}
          />
        </div>
      )}

      <PartnerFormDialog open={editing} onOpenChange={setEditing} partner={partner} />
    </>
  );
}
