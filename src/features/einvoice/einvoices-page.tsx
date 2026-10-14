import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from '@tanstack/react-router';
import { Inbox, Loader2, RefreshCw, Send, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  eInvoiceFindAll,
  eInvoiceSend,
  useEInvoiceFindAll,
  useEInvoiceSummary,
  useEInvoiceSync,
  useEInvoiceUnsent,
} from '@/api/generated/endpoints/e-invoice/e-invoice';
import {
  EInvoiceStatus,
  type EInvoiceDirection,
  type EInvoiceDto,
  type EInvoiceFindAllParams,
  type UnsentInvoiceDto,
} from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { KpiCard } from '@/features/reports/report-components';
import { DataTable } from '@/shared/components/data-table/data-table';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { useTableState } from '@/shared/components/data-table/use-table-state';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { fetchAllPages, tableQuery } from '@/shared/lib/query';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import {
  EInvoiceSettingsDialog,
  EInvoiceStatusBadge,
  ProfileBadge,
  SendEInvoiceDialog,
  SimulateIncomingDialog,
  useInvalidateEInvoices,
} from './einvoice-components';
import { IN_FLIGHT } from './einvoice-rules';

const ALL = '__all__';
const UNSENT_PREVIEW = 10;

/** e-Fatura / e-Arşiv: outgoing envelopes, the incoming inbox and invoices not sent yet. */
export function EInvoicesPage({
  direction,
  onDirection,
}: {
  direction: EInvoiceDirection;
  onDirection: (direction: EInvoiceDirection) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const can = usePermission();
  const table = useTableState({ sort: [{ id: 'createdAt', desc: true }] });
  const [status, setStatus] = useState(ALL);
  const [simulating, setSimulating] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState<UnsentInvoiceDto | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const invalidate = useInvalidateEInvoices();
  const sync = useEInvoiceSync();
  const outgoing = direction === 'OUTGOING';

  const params: EInvoiceFindAllParams = {
    ...table.params,
    direction,
    status: status === ALL ? undefined : (status as EInvoiceStatus),
  };
  const { data, isLoading } = useEInvoiceFindAll(params, {
    query: {
      ...tableQuery,
      refetchInterval: (query) =>
        query.state.data?.data.some((row) => IN_FLIGHT.includes(row.status)) ? 4000 : false,
    },
  });
  const { data: summary } = useEInvoiceSummary({
    query: { refetchInterval: (query) => (query.state.data?.inProgress ? 4000 : false) },
  });
  const { data: unsent } = useEInvoiceUnsent({ query: { enabled: outgoing } });

  const resetPage = () => table.setPagination((p) => ({ ...p, pageIndex: 0 }));
  const switchTo = (value: string) => {
    setStatus(ALL);
    resetPage();
    onDirection(value as EInvoiceDirection);
  };

  const runSync = () =>
    sync.mutate(undefined, {
      onSuccess: async (result) => {
        toast.success(t('einvoice.syncDone', { count: result.processed }));
        await invalidate();
      },
    });

  const sendAll = async () => {
    setSendingAll(true);
    let sent = 0;
    try {
      for (const row of unsent ?? []) {
        await eInvoiceSend({ salesInvoiceId: row.id });
        sent += 1;
      }
    } finally {
      setSendingAll(false);
      toast.success(t('einvoice.unsent.sentAll', { count: sent }));
      await invalidate();
    }
  };

  const columns = useMemo<ColumnDef<EInvoiceDto, unknown>[]>(
    () => [
      {
        id: 'number',
        header: t('einvoice.number'),
        cell: ({ row }) => (
          <Link
            to="/e-invoices/$id"
            params={{ id: row.original.id }}
            className="font-mono text-sm font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.number}
          </Link>
        ),
      },
      {
        id: 'issueDate',
        header: t('einvoice.issueDate'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{formatDate(row.original.issueDate)}</span>
        ),
      },
      {
        id: 'partner',
        header: outgoing ? t('einvoice.customer') : t('einvoice.supplier'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-64">
            <span className="line-clamp-1">{row.original.partnerTitle}</span>
            <span className="text-muted-foreground block font-mono text-xs">
              {row.original.partnerCode}
            </span>
          </span>
        ),
      },
      {
        id: 'profile',
        header: t('einvoice.profileLabel'),
        enableSorting: false,
        cell: ({ row }) => <ProfileBadge profile={row.original.profile} />,
      },
      {
        id: 'payableAmount',
        header: t('einvoice.amount'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap tabular-nums">
            {formatMoney(row.original.payableAmount, row.original.currencyCode)}
          </span>
        ),
      },
      {
        id: 'status',
        header: t('common.status'),
        enableSorting: false,
        cell: ({ row }) => (
          <span className="block max-w-72">
            <span className="inline-flex items-center gap-1">
              <EInvoiceStatusBadge status={row.original.status} />
              {row.original.canRespond && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  {t('einvoice.awaitingAnswer')}
                </span>
              )}
            </span>
            {row.original.statusMessage && (
              <span className="text-muted-foreground line-clamp-1 text-xs">
                {row.original.statusMessage}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'document',
        header: outgoing ? t('einvoice.salesInvoice') : t('einvoice.purchaseInvoice'),
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original;
          if (outgoing && r.salesInvoiceId) {
            return (
              <Link
                to="/sales/invoices/$id"
                params={{ id: r.salesInvoiceId }}
                className="text-primary font-mono text-xs hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {r.salesInvoiceNumber}
              </Link>
            );
          }
          if (!outgoing && r.purchaseInvoiceId) {
            return (
              <Link
                to="/purchasing/invoices/$id"
                params={{ id: r.purchaseInvoiceId }}
                className="text-primary font-mono text-xs hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {r.purchaseInvoiceNumber}
              </Link>
            );
          }
          return <span className="text-muted-foreground">—</span>;
        },
      },
    ],
    [t, outgoing],
  );

  const handleExport = async (format: ExportFormat) => {
    const rows = await fetchAllPages((page) => eInvoiceFindAll({ ...params, page, pageSize: 100 }));
    await exportTable(
      format,
      outgoing ? 'e-invoices-outgoing' : 'e-invoices-incoming',
      [
        { header: t('einvoice.number'), value: (r) => r.number },
        { header: t('einvoice.ettn'), value: (r) => r.uuid },
        { header: t('einvoice.issueDate'), value: (r) => new Date(r.issueDate) },
        {
          header: outgoing ? t('einvoice.customer') : t('einvoice.supplier'),
          value: (r) => r.partnerTitle,
        },
        { header: t('einvoice.profileLabel'), value: (r) => t(`einvoice.profile.${r.profile}`) },
        { header: t('einvoice.vat'), value: (r) => Number(r.taxTotal) },
        { header: t('einvoice.amount'), value: (r) => Number(r.payableAmount) },
        { header: t('trade.currency'), value: (r) => r.currencyCode },
        { header: t('common.status'), value: (r) => t(`einvoice.status.${r.status}`) },
        { header: t('einvoice.statusMessage'), value: (r) => r.statusMessage },
        {
          header: outgoing ? t('einvoice.salesInvoice') : t('einvoice.purchaseInvoice'),
          value: (r) => (outgoing ? r.salesInvoiceNumber : r.purchaseInvoiceNumber),
        },
      ],
      rows,
    );
  };

  const unsentRows = unsent ?? [];

  return (
    <>
      <PageHeader
        title={t('einvoice.title')}
        description={t('einvoice.subtitle')}
        actions={
          <>
            <Can permission="einvoice:update">
              <Button variant="outline" onClick={() => setSettingsOpen(true)}>
                <Settings2 /> {t('einvoice.settings.action')}
              </Button>
            </Can>
            <Can permission="einvoice:send">
              <Button variant="outline" onClick={runSync} disabled={sync.isPending}>
                {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {t('einvoice.sync')}
              </Button>
            </Can>
            <Can permission="einvoice:update">
              <Button onClick={() => setSimulating(true)}>
                <Inbox /> {t('einvoice.simulate.action')}
              </Button>
            </Can>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('einvoice.kpi.unsent')}
          value={summary?.unsent}
          hint={t('einvoice.kpi.unsentHint')}
        />
        <KpiCard
          label={t('einvoice.kpi.inProgress')}
          value={summary?.inProgress}
          hint={
            summary &&
            t('einvoice.kpi.monthHint', {
              count: summary.outgoingThisMonth,
              amount: formatMoney(summary.outgoingAmountThisMonth),
            })
          }
        />
        <KpiCard
          label={t('einvoice.kpi.errors')}
          value={summary?.errors}
          tone={summary?.errors ? 'negative' : undefined}
          hint={summary && t('einvoice.kpi.awaitingHint', { count: summary.awaitingResponse })}
        />
        <KpiCard
          label={t('einvoice.kpi.inbox')}
          value={summary && summary.toRespond + summary.toRecord}
          hint={
            summary &&
            t('einvoice.kpi.inboxHint', { respond: summary.toRespond, record: summary.toRecord })
          }
        />
      </div>

      <Tabs value={direction} onValueChange={switchTo} className="mb-4">
        <TabsList>
          <TabsTrigger value="OUTGOING">{t('einvoice.direction.OUTGOING')}</TabsTrigger>
          <TabsTrigger value="INCOMING">{t('einvoice.direction.INCOMING')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {outgoing && unsentRows.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle className="text-base">
                {t('einvoice.unsent.title')}
                <span className="text-muted-foreground ml-2 font-normal">
                  ({unsentRows.length})
                </span>
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-sm">{t('einvoice.unsent.hint')}</p>
            </div>
            {can('einvoice:send') && (
              <Button onClick={() => void sendAll()} disabled={sendingAll}>
                {sendingAll ? <Loader2 className="animate-spin" /> : <Send />}
                {t('einvoice.unsent.sendAll')}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('einvoice.salesInvoice')}</TableHead>
                  <TableHead>{t('einvoice.issueDate')}</TableHead>
                  <TableHead>{t('einvoice.customer')}</TableHead>
                  <TableHead>{t('einvoice.profileLabel')}</TableHead>
                  <TableHead className="text-right">{t('einvoice.amount')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {unsentRows.slice(0, UNSENT_PREVIEW).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Link
                        to="/sales/invoices/$id"
                        params={{ id: row.id }}
                        className="text-primary font-mono text-xs hover:underline"
                      >
                        {row.number}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(row.invoiceDate)}
                    </TableCell>
                    <TableCell className="max-w-64 truncate">{row.partnerTitle}</TableCell>
                    <TableCell>
                      <ProfileBadge profile={row.profile} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.grandTotal, row.currencyCode)}
                    </TableCell>
                    <TableCell className="text-right">
                      {can('einvoice:send') && (
                        <Button size="sm" variant="outline" onClick={() => setSending(row)}>
                          <Send /> {t('einvoice.send.action')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {unsentRows.length > UNSENT_PREVIEW && (
              <p className="text-muted-foreground mt-2 text-sm">
                {t('einvoice.unsent.more', { count: unsentRows.length - UNSENT_PREVIEW })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={data?.data}
        meta={data?.meta}
        isLoading={isLoading}
        state={table}
        onExport={handleExport}
        onRowClick={(row) => void navigate({ to: '/e-invoices/$id', params: { id: row.id } })}
        toolbar={
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value);
              resetPage();
            }}
          >
            <SelectTrigger className="w-44" aria-label={t('common.status')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('einvoice.allStatuses')}</SelectItem>
              {Object.values(EInvoiceStatus)
                .filter((value) => outgoing || !['QUEUED', 'SENT', 'ERROR'].includes(value))
                .map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`einvoice.status.${value}`)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        }
      />

      {sending && (
        <SendEInvoiceDialog
          open
          onOpenChange={(open) => !open && setSending(null)}
          salesInvoiceId={sending.id}
          number={sending.number}
        />
      )}
      <SimulateIncomingDialog
        open={simulating}
        onOpenChange={setSimulating}
        onCreated={(created) =>
          void navigate({ to: '/e-invoices/$id', params: { id: created.id } })
        }
      />
      <EInvoiceSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
