import { Link } from '@tanstack/react-router';
import { ArrowLeft, Ban, Banknote, CheckCheck, Landmark, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useChequesBounce,
  useChequesCollect,
  useChequesDeposit,
  useChequesFindOne,
  useChequesPay,
} from '@/api/generated/endpoints/finance/finance';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { DocumentHeader } from '@/features/trade/document-print';
import { Field } from '@/shared/components/info-card';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { RecordNotFound } from '@/shared/components/route-error';
import {
  ChequeActionDialog,
  ChequeStatusBadge,
  PaymentLink,
  useAccountOptions,
  useInvalidateFinance,
  type ChequeActionValues,
} from './finance-components';

type Action = 'deposit' | 'collect' | 'bounce' | 'pay';

export function ChequeDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidateFinance = useInvalidateFinance();
  const [action, setAction] = useState<Action | null>(null);
  const { data: cheque, isLoading } = useChequesFindOne(id);
  const deposit = useChequesDeposit();
  const collect = useChequesCollect();
  const bounce = useChequesBounce();
  const pay = useChequesPay();
  const banks = useAccountOptions({ types: ['BANK'], currencyCode: cheque?.currencyCode });
  const cashAndBanks = useAccountOptions({ currencyCode: cheque?.currencyCode });

  if (!cheque) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const received = cheque.direction === 'RECEIVED';
  const inPortfolio = received && cheque.status === 'PORTFOLIO';
  const atBank = received && cheque.status === 'DEPOSITED';
  const toPay = !received && cheque.status === 'ISSUED';
  const mutations = { deposit, collect, bounce, pay };

  const run = (values: ChequeActionValues) => {
    if (!action) return;
    mutations[action].mutate(
      { id, data: values },
      {
        onSuccess: async () => {
          toast.success(t('finance.cheques.done'));
          setAction(null);
          await invalidateFinance();
        },
      },
    );
  };

  const dialogAccounts =
    action === 'deposit'
      ? banks
      : action === 'collect'
        ? cashAndBanks
        : action === 'pay'
          ? cheque.kind === 'CHEQUE'
            ? banks
            : cashAndBanks
          : undefined;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          to="/finance/cheques"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="size-4" /> {t('finance.cheques.title')}
        </Link>
        <div className="flex flex-wrap gap-2">
          <Can permission="finance:create">
            {inPortfolio && cheque.kind === 'CHEQUE' && (
              <Button variant="outline" onClick={() => setAction('deposit')}>
                <Landmark /> {t('finance.cheques.actions.deposit')}
              </Button>
            )}
            {(inPortfolio || atBank) && (
              <Button onClick={() => setAction('collect')}>
                <CheckCheck /> {t('finance.cheques.actions.collect')}
              </Button>
            )}
            {toPay && (
              <Button onClick={() => setAction('pay')}>
                <Banknote /> {t('finance.cheques.actions.pay')}
              </Button>
            )}
          </Can>
          {(inPortfolio || atBank) && (
            <Can permission="finance:approve">
              <Button variant="outline" onClick={() => setAction('bounce')}>
                <Ban /> {t('finance.cheques.actions.bounce')}
              </Button>
            </Can>
          )}
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {t('trade.print')}
          </Button>
        </div>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6">
          <DocumentHeader
            title={`${t(`finance.chequeKinds.${cheque.kind}`)} · ${t(
              `finance.chequeDirections.${cheque.direction}`,
            )}`}
            number={cheque.number}
            status={<ChequeStatusBadge status={cheque.status} />}
            partner={{
              code: cheque.partnerCode,
              title: cheque.partnerTitle,
              label: t('finance.cheques.partner'),
            }}
          >
            <Field label={t('finance.cheques.amount')}>
              <span className="text-lg font-semibold tabular-nums">
                {formatMoney(cheque.amount, cheque.currencyCode)}
              </span>
            </Field>
            <Field label={t('finance.cheques.dueDate')}>
              <span className={cheque.overdue ? 'text-destructive font-medium' : undefined}>
                {formatDate(cheque.dueDate)}
              </span>
            </Field>
            <Field label={t('finance.cheques.serialNo')}>
              <code className="text-xs">{cheque.serialNo}</code>
            </Field>
            <Field label={t('finance.cheques.issueDate')}>{formatDate(cheque.issueDate)}</Field>
            <Field label={t('finance.cheques.bank')}>
              {[cheque.bankName, cheque.branchName].filter(Boolean).join(' / ') || null}
            </Field>
            <Field label={t('finance.cheques.drawer')}>{cheque.drawer}</Field>
            {cheque.accountId && (
              <Field label={t('finance.cheques.account')}>
                {can('finance:read') ? (
                  <Link
                    to="/finance/accounts/$id"
                    params={{ id: cheque.accountId }}
                    className="text-primary hover:underline print:no-underline"
                  >
                    {cheque.accountName}
                  </Link>
                ) : (
                  cheque.accountName
                )}
              </Field>
            )}
            <Field label={t('finance.cheques.originPayment')}>
              <PaymentLink
                id={cheque.originPaymentId}
                number={cheque.originPaymentNumber}
                direction={received ? 'IN' : 'OUT'}
              />
            </Field>
            {cheque.endorsementPaymentId && cheque.endorsementPaymentNumber && (
              <Field label={t('finance.cheques.endorsedTo')}>
                <span className="font-medium">{cheque.endorsedToTitle}</span>
                <span className="block">
                  <PaymentLink
                    id={cheque.endorsementPaymentId}
                    number={cheque.endorsementPaymentNumber}
                    direction="OUT"
                  />
                </span>
              </Field>
            )}
          </DocumentHeader>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t('finance.cheques.history')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l pl-6">
            {cheque.events.map((event) => (
              <li key={event.id}>
                <span className="bg-primary absolute -left-1.5 mt-1.5 size-3 rounded-full" />
                <div className="flex flex-wrap items-center gap-2">
                  <ChequeStatusBadge status={event.toStatus} />
                  <span className="text-sm">{formatDate(event.eventDate)}</span>
                  {(event.accountName || event.partnerTitle) && (
                    <span className="text-muted-foreground text-sm">
                      · {event.accountName ?? event.partnerTitle}
                    </span>
                  )}
                </div>
                {event.note && <p className="mt-1 text-sm whitespace-pre-line">{event.note}</p>}
                <p className="text-muted-foreground text-xs">
                  {event.createdByName} · {formatDateTime(event.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <ChequeActionDialog
        open={!!action}
        onOpenChange={(open) => !open && setAction(null)}
        title={action ? t(`finance.cheques.actions.${action}`) : ''}
        description={action ? t(`finance.cheques.hints.${action}`) : ''}
        accounts={dialogAccounts}
        defaultAccountId={cheque.accountId}
        minDate={cheque.issueDate}
        destructive={action === 'bounce'}
        pending={action ? mutations[action].isPending : false}
        onConfirm={run}
      />
    </>
  );
}
