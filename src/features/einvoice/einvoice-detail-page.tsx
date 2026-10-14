import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FilePlus2,
  Loader2,
  RotateCcw,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  useEInvoiceFindOne,
  useEInvoiceRecord,
  useEInvoiceResend,
} from '@/api/generated/endpoints/e-invoice/e-invoice';
import type { EInvoiceDetailDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { today } from '@/features/trade/trade-components';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatDateTime, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import {
  EInvoiceStatusBadge,
  ProfileBadge,
  RespondDialog,
  useInvalidateEInvoices,
} from './einvoice-components';
import { daysLeft, IN_FLIGHT } from './einvoice-rules';

const percent = (value: string) => `%${Number(value).toLocaleString()}`;

function downloadXml(eInvoice: EInvoiceDetailDto) {
  const url = URL.createObjectURL(new Blob([eInvoice.xml], { type: 'application/xml' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${eInvoice.number}.xml`;
  link.click();
  URL.revokeObjectURL(url);
}

export function EInvoiceDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const can = usePermission();
  const invalidate = useInvalidateEInvoices();
  const [answer, setAnswer] = useState<'ACCEPT' | 'REJECT' | null>(null);
  const { data: eInvoice, isLoading } = useEInvoiceFindOne(id, {
    query: {
      refetchInterval: (query) =>
        query.state.data && IN_FLIGHT.includes(query.state.data.status) ? 3000 : false,
    },
  });
  const resend = useEInvoiceResend();
  const record = useEInvoiceRecord();

  if (!eInvoice) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const incoming = eInvoice.direction === 'INCOMING';
  const currency = eInvoice.currencyCode;
  const money = (value: string) => formatMoney(value, currency);
  const canAnswer = eInvoice.canRespond && can(incoming ? 'einvoice:update' : 'einvoice:send');
  const left = eInvoice.responseDeadline ? daysLeft(eInvoice.responseDeadline, today()) : null;

  const onResend = () =>
    resend.mutate(
      { id },
      {
        onSuccess: async () => {
          toast.success(t('einvoice.resent'));
          await invalidate();
        },
      },
    );
  const onRecord = () =>
    record.mutate(
      { id },
      {
        onSuccess: async (saved) => {
          toast.success(t('einvoice.recorded', { number: saved.purchaseInvoiceNumber }));
          await invalidate();
        },
      },
    );
  const copyXml = async () => {
    await navigator.clipboard.writeText(eInvoice.xml);
    toast.success(t('einvoice.xml.copied'));
  };

  return (
    <>
      <Link
        to="/e-invoices"
        search={{ direction: eInvoice.direction }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('einvoice.title')}
      </Link>
      <PageHeader
        title={eInvoice.number}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <span>{t(`einvoice.direction.${eInvoice.direction}`)}</span>
            <ProfileBadge profile={eInvoice.profile} />
            <EInvoiceStatusBadge status={eInvoice.status} />
          </span>
        }
        actions={
          <>
            {eInvoice.canResend && can('einvoice:send') && (
              <Button onClick={onResend} disabled={resend.isPending}>
                {resend.isPending ? <Loader2 className="animate-spin" /> : <RotateCcw />}
                {t('einvoice.resend')}
              </Button>
            )}
            {canAnswer && (
              <>
                <Button onClick={() => setAnswer('ACCEPT')}>
                  <Check /> {incoming ? t('einvoice.accept') : t('einvoice.simulateAccept')}
                </Button>
                <Button variant="outline" onClick={() => setAnswer('REJECT')}>
                  <X /> {incoming ? t('einvoice.reject') : t('einvoice.simulateReject')}
                </Button>
              </>
            )}
            {eInvoice.canRecord && can('einvoice:update') && can('purchasing:create') && (
              <Button onClick={onRecord} disabled={record.isPending}>
                {record.isPending ? <Loader2 className="animate-spin" /> : <FilePlus2 />}
                {t('einvoice.record')}
              </Button>
            )}
            <Button variant="outline" onClick={() => downloadXml(eInvoice)}>
              <Download /> {t('einvoice.xml.download')}
            </Button>
          </>
        }
      />

      {eInvoice.status === 'ERROR' && eInvoice.statusMessage && (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mb-4 flex gap-2 rounded-md border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">{t('einvoice.errorTitle', { code: eInvoice.statusCode })}</p>
            <p>{eInvoice.statusMessage}</p>
            {eInvoice.canResend && <p className="mt-1">{t('einvoice.errorHint')}</p>}
          </div>
        </div>
      )}
      {eInvoice.canRespond && left !== null && (
        <div className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          {t(incoming ? 'einvoice.respondBy' : 'einvoice.awaitingReceiver', {
            date: formatDate(eInvoice.responseDeadline),
            count: Math.max(left, 0),
          })}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('einvoice.document')}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={incoming ? t('einvoice.supplier') : t('einvoice.customer')}>
                {can('partners:read') ? (
                  <Link
                    to="/partners/$id"
                    params={{ id: eInvoice.partnerId }}
                    className="text-primary hover:underline"
                  >
                    {eInvoice.partnerTitle}
                  </Link>
                ) : (
                  eInvoice.partnerTitle
                )}
              </Field>
              <Field label={t('einvoice.issueDate')}>{formatDate(eInvoice.issueDate)}</Field>
              <Field label={t('einvoice.ettn')}>
                <code className="text-xs break-all">{eInvoice.uuid}</code>
              </Field>
              <Field label={t('einvoice.senderTaxId')}>{eInvoice.senderTaxId}</Field>
              <Field label={t('einvoice.receiverTaxId')}>{eInvoice.receiverTaxId}</Field>
              <Field label={t('trade.currency')}>
                {currency}
                {currency !== 'TRY' && ` · ${Number(eInvoice.exchangeRate)}`}
              </Field>
              <Field label={t('einvoice.senderAlias')}>
                {eInvoice.senderAlias && (
                  <code className="text-xs break-all">{eInvoice.senderAlias}</code>
                )}
              </Field>
              <Field label={t('einvoice.receiverAlias')}>
                {eInvoice.receiverAlias && (
                  <code className="text-xs break-all">{eInvoice.receiverAlias}</code>
                )}
              </Field>
              {incoming ? (
                <Field label={t('einvoice.purchaseInvoice')}>
                  {eInvoice.purchaseInvoiceId && (
                    <Link
                      to="/purchasing/invoices/$id"
                      params={{ id: eInvoice.purchaseInvoiceId }}
                      className="text-primary font-mono text-xs hover:underline"
                    >
                      {eInvoice.purchaseInvoiceNumber}
                    </Link>
                  )}
                </Field>
              ) : (
                <Field label={t('einvoice.salesInvoice')}>
                  {eInvoice.salesInvoiceId && (
                    <Link
                      to="/sales/invoices/$id"
                      params={{ id: eInvoice.salesInvoiceId }}
                      className="text-primary font-mono text-xs hover:underline"
                    >
                      {eInvoice.salesInvoiceNumber}
                    </Link>
                  )}
                </Field>
              )}
              <Field label={t('einvoice.statusMessage')}>
                {eInvoice.statusCode && <code className="mr-1 text-xs">{eInvoice.statusCode}</code>}
                {eInvoice.statusMessage}
              </Field>
              {eInvoice.responseDeadline && (
                <Field label={t('einvoice.responseDeadline')}>
                  {formatDate(eInvoice.responseDeadline)}
                </Field>
              )}
              {eInvoice.responseNote && (
                <Field label={t('einvoice.respond.reason')}>{eInvoice.responseNote}</Field>
              )}
              {eInvoice.createdByName && (
                <Field label={t('common.createdBy')}>
                  {eInvoice.createdByName}
                  <span className="text-muted-foreground block text-xs">
                    {formatDateTime(eInvoice.createdAt)}
                  </span>
                </Field>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('einvoice.history')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-4">
              {eInvoice.events.map((event) => (
                <li key={event.id} className="relative">
                  <span
                    className={cn(
                      'bg-background absolute top-1 -left-[21px] size-2.5 rounded-full border-2',
                      event.status === 'ERROR' || event.status === 'REJECTED'
                        ? 'border-destructive'
                        : event.status === 'ACCEPTED'
                          ? 'border-emerald-500'
                          : 'border-primary',
                    )}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <EInvoiceStatusBadge status={event.status} />
                    {event.code && (
                      <code className="text-muted-foreground text-xs">{event.code}</code>
                    )}
                  </div>
                  <p className="mt-1 text-sm">{event.message}</p>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(event.createdAt)}
                    {event.userName && ` · ${event.userName}`}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">{t('einvoice.lines')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>{t('einvoice.item')}</TableHead>
                <TableHead className="text-right">{t('einvoice.quantity')}</TableHead>
                <TableHead className="text-right">{t('einvoice.unitPrice')}</TableHead>
                <TableHead className="text-right">{t('einvoice.discount')}</TableHead>
                <TableHead className="text-right">{t('einvoice.net')}</TableHead>
                <TableHead className="text-right">{t('einvoice.vat')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eInvoice.lines.map((line) => (
                <TableRow key={line.lineNo}>
                  <TableCell className="text-muted-foreground">{line.lineNo}</TableCell>
                  <TableCell>
                    {line.description}
                    {line.sellerCode && (
                      <span className="text-muted-foreground block font-mono text-xs">
                        {line.sellerCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {Number(line.quantity).toLocaleString()}{' '}
                    <span className="text-muted-foreground text-xs">
                      {t(`einvoice.units.${line.unitCode}`, { defaultValue: line.unitCode })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(line.unitPrice, currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(line.discount) > 0
                      ? `${money(line.discount)} (${percent(line.discountRate)})`
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(line.net)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {money(line.vat)}
                    <span className="text-muted-foreground block text-xs">
                      {percent(line.vatRate)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <dl className="mt-4 ml-auto grid max-w-sm gap-1 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{t('einvoice.lineExtension')}</dt>
              <dd className="tabular-nums">{money(eInvoice.lineExtensionAmount)}</dd>
            </div>
            {Number(eInvoice.allowanceTotal) > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t('einvoice.allowance')}</dt>
                <dd className="tabular-nums">{money(eInvoice.allowanceTotal)}</dd>
              </div>
            )}
            {eInvoice.taxes.map((tax) => (
              <div key={tax.rate} className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t('einvoice.vatAt', { rate: percent(tax.rate), base: money(tax.base) })}
                </dt>
                <dd className="tabular-nums">{money(tax.vat)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 border-t pt-1 font-semibold">
              <dt>{t('einvoice.payable')}</dt>
              <dd className="tabular-nums">{money(eInvoice.payableAmount)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">{t('einvoice.xml.title')}</CardTitle>
            <p className="text-muted-foreground mt-1 text-sm">{t('einvoice.xml.hint')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void copyXml()}>
              <Copy /> {t('einvoice.xml.copy')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadXml(eInvoice)}>
              <Download /> {t('einvoice.xml.download')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted max-h-[28rem] overflow-auto rounded-md p-3 font-mono text-xs leading-relaxed">
            {eInvoice.xml}
          </pre>
        </CardContent>
      </Card>

      {answer && (
        <RespondDialog
          open
          onOpenChange={(open) => !open && setAnswer(null)}
          eInvoice={eInvoice}
          action={answer}
        />
      )}
    </>
  );
}
