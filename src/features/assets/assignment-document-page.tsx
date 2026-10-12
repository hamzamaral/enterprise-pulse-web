import { Link, useRouter } from '@tanstack/react-router';
import { ArrowLeft, BadgeCheck, Loader2, Printer } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  getAssetAssignmentsFindMineQueryKey,
  getAssetAssignmentsFindOneQueryKey,
  useAssetAssignmentsAcknowledge,
  useAssetAssignmentsFindOne,
} from '@/api/generated/endpoints/assets/assets';
import type { AssignmentDocumentDto } from '@/api/generated/model';
import { formatDate, formatDateTime } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { RecordNotFound } from '@/shared/components/route-error';
import { AssignmentStatusBadge } from './asset-components';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[10rem_1fr] gap-2 py-1 text-sm">
      <span className="text-muted-foreground print:text-neutral-600">{label}</span>
      <span>{children || '—'}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="border-b pb-1 text-xs font-semibold tracking-wide uppercase">{title}</h2>
      {children}
    </section>
  );
}

function SignatureBox({
  role,
  name,
  stamp,
}: {
  role: string;
  name: string | null;
  stamp?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col rounded-md border p-4 text-sm">
      <span className="text-xs font-semibold uppercase">{role}</span>
      <span className="mt-1">{name ?? '—'}</span>
      <div className="mt-auto min-h-16 pt-4">{stamp}</div>
      <span className="text-muted-foreground border-t pt-1 text-xs print:text-neutral-600">
        {t('assets.document.signature')}
      </span>
    </div>
  );
}

function Document({ doc }: { doc: AssignmentDocumentDto }) {
  const { t } = useTranslation();
  const isEmployee = doc.assigneeType === 'EMPLOYEE';
  return (
    <article className="bg-card mx-auto max-w-3xl space-y-6 rounded-lg border p-8 shadow-sm print:max-w-none print:border-0 print:bg-white print:p-0 print:text-black print:shadow-none">
      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-lg font-semibold">{doc.companyName}</div>
          {doc.companyAddress && (
            <div className="text-muted-foreground max-w-xs text-xs print:text-neutral-600">
              {doc.companyAddress}
            </div>
          )}
        </div>
        <div className="text-right text-sm">
          <div className="font-mono font-semibold">{doc.number}</div>
          <div>{formatDate(doc.assignedAt)}</div>
        </div>
      </header>

      <h1 className="text-center text-xl font-bold tracking-wide uppercase">
        {t('assets.document.title')}
      </h1>

      <Section title={t('assets.document.recipient')}>
        <Row label={t('assets.assigneeType')}>{t(`assets.assigneeTypes.${doc.assigneeType}`)}</Row>
        <Row label={t('assets.document.name')}>{doc.assignee.name}</Row>
        {isEmployee && (
          <>
            <Row label={t('employees.employeeNo')}>{doc.assignee.employeeNo}</Row>
            <Row label={t('employees.department')}>{doc.assignee.departmentName}</Row>
            <Row label={t('employees.position')}>{doc.assignee.positionName}</Row>
          </>
        )}
      </Section>

      <Section title={t('assets.document.assetInfo')}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs print:text-neutral-600">
              <th className="py-1 font-medium">{t('assets.assetTag')}</th>
              <th className="py-1 font-medium">{t('assets.asset')}</th>
              <th className="py-1 font-medium">{t('assets.brandModel')}</th>
              <th className="py-1 font-medium">{t('assets.serialNumber')}</th>
              <th className="py-1 font-medium">{t('assets.condition')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-2 font-mono text-xs">{doc.asset.assetTag}</td>
              <td className="py-2">
                {doc.asset.name}
                <div className="text-muted-foreground text-xs print:text-neutral-600">
                  {doc.asset.categoryName}
                </div>
              </td>
              <td className="py-2">
                {[doc.asset.brand, doc.asset.model].filter(Boolean).join(' ') || '—'}
              </td>
              <td className="py-2">{doc.asset.serialNumber ?? '—'}</td>
              <td className="py-2">{t(`assets.conditions.${doc.conditionOut}`)}</td>
            </tr>
          </tbody>
        </table>
        <Row label={t('assets.expectedReturnDate')}>
          {doc.expectedReturnDate && formatDate(doc.expectedReturnDate)}
        </Row>
        {doc.notes && <Row label={t('common.notes')}>{doc.notes}</Row>}
      </Section>

      <p className="text-sm leading-relaxed">
        {t('assets.document.statement', { name: doc.assignee.name })}
      </p>

      {doc.status === 'RETURNED' && (
        <Section title={t('assets.document.returnInfo')}>
          <Row label={t('assets.returnedAt')}>{formatDate(doc.returnedAt)}</Row>
          <Row label={t('assets.conditionIn')}>
            {doc.conditionIn && t(`assets.conditions.${doc.conditionIn}`)}
          </Row>
          <Row label={t('assets.document.receivedBy')}>{doc.returnedByName}</Row>
          {doc.returnNotes && <Row label={t('common.notes')}>{doc.returnNotes}</Row>}
        </Section>
      )}

      <div className="grid grid-cols-2 gap-4 pt-4">
        <SignatureBox role={t('assets.document.deliveredBy')} name={doc.assignedByName} />
        <SignatureBox
          role={t('assets.document.receivedByRecipient')}
          name={isEmployee ? doc.assignee.name : null}
          stamp={
            doc.acknowledgedAt && (
              <span className="inline-flex items-center gap-1.5 rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-700">
                <BadgeCheck className="size-3.5" />
                {t('assets.document.eSigned', { date: formatDateTime(doc.acknowledgedAt) })}
              </span>
            )
          }
        />
      </div>
    </article>
  );
}

export function AssignmentDocumentPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const invalidate = useInvalidate();
  const { data: doc, isLoading } = useAssetAssignmentsFindOne(id);
  const acknowledge = useAssetAssignmentsAcknowledge();

  if (!doc) {
    if (!isLoading) return <RecordNotFound />;
    return <Skeleton className="mx-auto h-[600px] max-w-3xl" />;
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          <ArrowLeft /> {t('common.back')}
        </Button>
        <AssignmentStatusBadge status={doc.status} />
        <Link
          to="/assets/$id"
          params={{ id: doc.assetId }}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {doc.assetTag}
        </Link>
        <div className="ml-auto flex gap-2">
          {doc.canAcknowledge && (
            <Button
              disabled={acknowledge.isPending}
              onClick={() =>
                acknowledge.mutate(
                  { id },
                  {
                    onSuccess: async () => {
                      toast.success(t('assets.acknowledgedToast'));
                      await invalidate(
                        getAssetAssignmentsFindOneQueryKey(id),
                        getAssetAssignmentsFindMineQueryKey(),
                      );
                    },
                  },
                )
              }
            >
              {acknowledge.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
              {t('assets.acknowledge')}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {t('assets.document.print')}
          </Button>
        </div>
      </div>
      <Document doc={doc} />
    </div>
  );
}
