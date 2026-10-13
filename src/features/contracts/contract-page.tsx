import { Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  Ban,
  Loader2,
  Paperclip,
  Pencil,
  RefreshCw,
  Signature,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  contractsAttachmentUrl,
  useContractsCancelTermination,
  useContractsFindOne,
  useContractsRemove,
  useContractsRemoveAttachment,
  useContractsUploadAttachment,
} from '@/api/generated/endpoints/contracts/contracts';
import type { ContractDetailDto, ContractEventDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { CvButton } from '@/features/recruitment/recruitment-components';
import { ConfirmDialog } from '@/shared/components/confirm-dialog';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney, formatRelative } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  ContractStateBadge,
  formatContractAmount,
  TermCell,
  useInvalidateContracts,
} from './contract-components';
import { ActivateDialog, RenewDialog, TerminateDialog } from './contract-dialogs';
import { ContractFormDialog } from './contract-form-dialog';

type DialogKind = 'edit' | 'activate' | 'renew' | 'terminate';

export function ContractPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const invalidate = useInvalidateContracts();
  const { data: contract, isLoading } = useContractsFindOne(id);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const remove = useContractsRemove();
  const cancel = useContractsCancelTermination();

  if (!contract) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const dialogProps = (kind: DialogKind) => ({
    contract,
    open: dialog === kind,
    onOpenChange: (open: boolean) => setDialog(open ? kind : null),
  });

  return (
    <>
      {can('contracts:read') && (
        <Link
          to="/contracts"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('contracts.title')}
        </Link>
      )}
      <PageHeader
        title={contract.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{contract.number}</code>
            <ContractStateBadge state={contract.state} />
            <span className="text-muted-foreground text-sm">
              {contract.typeName} · {contract.partyName}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {contract.canActivate && (
              <Button onClick={() => setDialog('activate')}>
                <Signature /> {t('contracts.activate')}
              </Button>
            )}
            {contract.canRenew && (
              <Button
                variant={contract.state === 'ACTIVE' ? 'outline' : 'default'}
                onClick={() => setDialog('renew')}
              >
                <RefreshCw /> {t('contracts.renew')}
              </Button>
            )}
            {contract.canEdit && (
              <Button variant="outline" onClick={() => setDialog('edit')}>
                <Pencil /> {t('common.edit')}
              </Button>
            )}
            {contract.canTerminate && (
              <Button variant="outline" onClick={() => setDialog('terminate')}>
                <Ban /> {t('contracts.terminate')}
              </Button>
            )}
            {contract.canCancelTermination && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" disabled={cancel.isPending}>
                    <Undo2 /> {t('contracts.cancelTermination')}
                  </Button>
                }
                title={t('contracts.cancelTerminationTitle')}
                description={t('contracts.cancelTerminationHint')}
                confirmLabel={t('contracts.cancelTermination')}
                onConfirm={() =>
                  cancel.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('contracts.terminationCancelled'));
                        await invalidate();
                      },
                    },
                  )
                }
              />
            )}
            {contract.canDelete && (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" className="text-destructive">
                    <Trash2 /> {t('common.delete')}
                  </Button>
                }
                onConfirm={() =>
                  remove.mutate(
                    { id },
                    {
                      onSuccess: async () => {
                        toast.success(t('contracts.deleted'));
                        await navigate({ to: '/contracts' });
                        await invalidate();
                      },
                    },
                  )
                }
              />
            )}
          </div>
        }
      />

      {contract.state === 'EXPIRING' && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          {contract.autoRenew
            ? t('contracts.noticeWarning', {
                date: formatDate(contract.noticeDeadline),
                months: contract.renewalMonths,
              })
            : t('contracts.expiryWarning', { date: formatDate(contract.endDate) })}
        </div>
      )}
      {contract.state === 'TERMINATING' && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm">
          {t('contracts.terminatingNotice', {
            date: formatDate(contract.terminatedOn),
            reason: contract.terminationReason,
          })}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <DetailsCard contract={contract} />
          <TermCard contract={contract} />
        </div>
        <div className="space-y-4">
          <AttachmentsCard contract={contract} canUpload={can('contracts:update')} />
          <HistoryCard events={contract.events} />
        </div>
      </div>

      <ContractFormDialog {...dialogProps('edit')} />
      <ActivateDialog {...dialogProps('activate')} />
      <RenewDialog {...dialogProps('renew')} />
      <TerminateDialog {...dialogProps('terminate')} />
    </>
  );
}

function DetailsCard({ contract }: { contract: ContractDetailDto }) {
  const { t } = useTranslation();
  const can = usePermission();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('common.details')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Field label={t(`contracts.party.${contract.party}`)}>
            {contract.partnerId && can('partners:read') ? (
              <Link
                to="/partners/$id"
                params={{ id: contract.partnerId }}
                className="hover:underline"
              >
                {contract.partyName}
              </Link>
            ) : contract.employeeId && can('employees:read') ? (
              <Link
                to="/hr/employees/$id"
                params={{ id: contract.employeeId }}
                className="hover:underline"
              >
                {contract.partyName}
              </Link>
            ) : (
              contract.partyName
            )}
            {contract.partnerCode && (
              <span className="text-muted-foreground block text-xs">{contract.partnerCode}</span>
            )}
          </Field>
          <Field label={t('contracts.type')}>
            {contract.typeName}
            <span className="text-muted-foreground block text-xs">
              {t(`contracts.flow.${contract.flow}`)}
            </span>
          </Field>
          <Field label={t('contracts.owner')}>{contract.ownerName}</Field>
          <Field label={t('contracts.amount')}>
            {formatContractAmount(contract.amount, contract.currencyCode, contract.billingCycle)}
          </Field>
          <Field label={t('contracts.annualValue')}>
            {contract.annualValue ? formatMoney(contract.annualValue, contract.currencyCode) : '—'}
          </Field>
          <Field label={t('contracts.signedDate')}>{formatDate(contract.signedDate)}</Field>
          {contract.description && (
            <div className="sm:col-span-3">
              <Field label={t('common.description')}>
                <span className="whitespace-pre-line">{contract.description}</span>
              </Field>
            </div>
          )}
          <div className="text-muted-foreground text-xs sm:col-span-3">
            {t('contracts.createdBy', {
              name: contract.createdByName,
              date: formatDateTime(contract.createdAt),
            })}
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function TermCard({ contract }: { contract: ContractDetailDto }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('contracts.term')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <Field label={t('contracts.period')}>
              <TermCell contract={contract} />
            </Field>
          </div>
          <Field label={t('contracts.autoRenew')}>
            {contract.autoRenew
              ? t('contracts.renewsFor', { count: contract.renewalMonths ?? 0 })
              : t('common.no')}
          </Field>
          <Field label={t('contracts.noticeDeadline')}>
            {contract.autoRenew ? (
              <>
                {formatDate(contract.noticeDeadline)}
                <span className="text-muted-foreground block text-xs">
                  {t('contracts.noticeDaysValue', { count: contract.noticeDays })}
                </span>
              </>
            ) : (
              '—'
            )}
          </Field>
          <Field label={t('contracts.reminderDays')}>
            {contract.endDate
              ? t('contracts.reminderValue', { count: contract.reminderDays })
              : '—'}
          </Field>
          <Field label={t('contracts.renewalCount')}>{contract.renewalCount}</Field>
          {contract.terminatedOn && (
            <>
              <Field label={t('contracts.terminatedOn')}>{formatDate(contract.terminatedOn)}</Field>
              <Field label={t('contracts.terminationReason')}>{contract.terminationReason}</Field>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function AttachmentsCard({
  contract,
  canUpload,
}: {
  contract: ContractDetailDto;
  canUpload: boolean;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateContracts();
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useContractsUploadAttachment();
  const remove = useContractsRemoveAttachment();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    upload.mutate(
      { id: contract.id, data: { file } },
      {
        onSuccess: async () => {
          toast.success(t('contracts.fileAdded'));
          await invalidate();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('contracts.attachments')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!contract.attachments.length && (
          <p className="text-muted-foreground text-sm">{t('contracts.noAttachments')}</p>
        )}
        {contract.attachments.map((file) => (
          <div key={file.id} className="flex items-center gap-1">
            <CvButton
              load={() => contractsAttachmentUrl(contract.id, file.id)}
              name={file.originalName}
              className="min-w-0 flex-1 justify-start"
            />
            {canUpload && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('common.delete')}
                disabled={remove.isPending}
                onClick={() =>
                  remove.mutate(
                    { id: contract.id, fileId: file.id },
                    { onSuccess: () => void invalidate() },
                  )
                }
              >
                <X />
              </Button>
            )}
          </div>
        ))}
        {canUpload && (
          <>
            <input
              ref={fileInput}
              type="file"
              className="hidden"
              aria-label={t('contracts.addFile')}
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => fileInput.current?.click()}
            >
              {upload.isPending ? <Loader2 className="animate-spin" /> : <Paperclip />}
              {t('contracts.addFile')}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function HistoryCard({ events }: { events: ContractEventDto[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('contracts.history')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {[...events].reverse().map((event) => (
            <li key={event.id} className="border-l-2 pl-3 text-sm">
              {t(`contracts.events.${event.type}`, {
                actor: event.actorName ?? t('contracts.system'),
                from: formatDate(event.fromValue),
                to: formatDate(event.toValue),
              })}
              {event.note && (
                <span className="text-muted-foreground block text-xs">“{event.note}”</span>
              )}
              <span
                className="text-muted-foreground block text-xs"
                title={formatDateTime(event.createdAt)}
              >
                {formatRelative(event.createdAt)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
