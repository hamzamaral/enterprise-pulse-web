import { Link } from '@tanstack/react-router';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  getTreasuryAccountsFindAllQueryKey,
  getTreasuryAccountsFindOneQueryKey,
  useTreasuryAccountsFindOne,
  useTreasuryAccountsStatement,
  useTreasuryAccountsUpdate,
} from '@/api/generated/endpoints/finance/finance';
import type { TreasuryDocumentType, TreasuryEntryDto } from '@/api/generated/model';
import { Can } from '@/features/auth/can';
import { usePermission } from '@/features/auth/use-session';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { exportTable, type ExportFormat } from '@/shared/components/data-table/export-table';
import { Field } from '@/shared/components/info-card';
import { PageHeader } from '@/shared/components/page-header';
import { SimpleFormDialog } from '@/shared/components/simple-form-dialog';
import { ActiveBadge } from '@/shared/components/status-badge';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { useInvalidate } from '@/shared/lib/query';
import { cn } from '@/shared/lib/utils';
import { v } from '@/shared/lib/validation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { RecordNotFound } from '@/shared/components/route-error';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { AccountTypeBadge } from './finance-components';

const startOfYear = () => `${new Date().getFullYear()}-01-01`;

const editSchema = z.object({
  name: v.requiredString(),
  bankName: z.string(),
  branchName: z.string(),
  iban: z.string(),
  isActive: z.boolean(),
});
type EditValues = z.infer<typeof editSchema>;

/** Treasury document number linked to the receipt or cheque behind it. */
function TreasuryDocumentLink({ entry }: { entry: TreasuryEntryDto }) {
  const can = usePermission();
  const className = 'text-primary font-mono text-xs hover:underline print:no-underline';
  const id = entry.documentId;
  const type: TreasuryDocumentType = entry.documentType;
  if (id && can('finance:read')) {
    if (type === 'COLLECTION' || type === 'PAYMENT') {
      return (
        <Link
          to={type === 'COLLECTION' ? '/finance/collections/$id' : '/finance/payments/$id'}
          params={{ id }}
          className={className}
        >
          {entry.documentNumber}
        </Link>
      );
    }
    if (type === 'CHEQUE_COLLECTION' || type === 'CHEQUE_PAYMENT') {
      return (
        <Link to="/finance/cheques/$id" params={{ id }} className={className}>
          {entry.documentNumber}
        </Link>
      );
    }
  }
  if (id && type === 'EXPENSE_PAYMENT' && can('expenses:read')) {
    return (
      <Link to="/expenses/$id" params={{ id }} className={className}>
        {entry.documentNumber}
      </Link>
    );
  }
  if (id && type === 'PAYROLL_PAYMENT' && can('payroll:read')) {
    return (
      <Link to="/payroll/$id" params={{ id }} className={className}>
        {entry.documentNumber}
      </Link>
    );
  }
  return <code className="text-xs">{entry.documentNumber}</code>;
}

export function TreasuryAccountDetailPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const invalidate = useInvalidate();
  const base = useBaseCurrency();
  const [editing, setEditing] = useState(false);
  const [dateFrom, setDateFrom] = useState(startOfYear());
  const [dateTo, setDateTo] = useState('');
  const { data: account, isLoading } = useTreasuryAccountsFindOne(id);
  const { data: statement } = useTreasuryAccountsStatement(id, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  const update = useTreasuryAccountsUpdate();

  if (!account) {
    if (!isLoading) return <RecordNotFound />;
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  const currency = account.currencyCode;

  const handleExport = async (format: ExportFormat) => {
    if (!statement) return;
    await exportTable<TreasuryEntryDto>(
      format,
      `account-${account.code}`,
      [
        { header: t('statement.date'), value: (e) => new Date(e.txDate) },
        { header: t('statement.document'), value: (e) => e.documentNumber },
        {
          header: t('statement.documentType'),
          value: (e) => t(`finance.treasuryDocs.${e.documentType}`),
        },
        { header: t('common.description'), value: (e) => e.description },
        { header: t('finance.accounts.in'), value: (e) => Number(e.amountIn) },
        { header: t('finance.accounts.out'), value: (e) => Number(e.amountOut) },
        { header: t('finance.accounts.balance'), value: (e) => Number(e.balance) },
      ],
      statement.entries,
    );
  };

  const onEdit = (values: EditValues) =>
    update.mutate(
      {
        id,
        data: {
          name: values.name,
          bankName: values.bankName,
          branchName: values.branchName,
          iban: values.iban,
          isActive: values.isActive,
        },
      },
      {
        onSuccess: async () => {
          toast.success(t('common.saved'));
          setEditing(false);
          await invalidate(
            getTreasuryAccountsFindAllQueryKey(),
            getTreasuryAccountsFindOneQueryKey(id),
          );
        },
      },
    );

  return (
    <>
      <Link
        to="/finance/accounts"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm print:hidden"
      >
        <ArrowLeft className="size-4" /> {t('finance.accounts.title')}
      </Link>
      <PageHeader
        title={account.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="text-xs">{account.code}</code>
            <AccountTypeBadge type={account.type} />
            <ActiveBadge active={account.isActive} />
          </span>
        }
        actions={
          <Can permission="finance:update">
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
              <Field label={t('trade.currency')}>{currency}</Field>
              <Field label={t('finance.accounts.bankName')}>{account.bankName}</Field>
              <Field label={t('finance.accounts.branchName')}>{account.branchName}</Field>
              <div className="sm:col-span-3">
                <Field label={t('finance.accounts.iban')}>
                  {account.iban && <code className="text-xs">{account.iban}</code>}
                </Field>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('finance.accounts.balance')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-semibold tabular-nums',
                Number(account.balance) < 0 && 'text-destructive',
              )}
            >
              {formatMoney(account.balance, currency)}
            </div>
            {currency !== base && (
              <div className="text-muted-foreground text-sm tabular-nums">
                ≈ {formatMoney(account.balanceBase, base)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4 print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle className="text-base">{t('finance.accounts.statement')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 print:hidden">
            <div className="space-y-1">
              <Label htmlFor="account-from">{t('statement.dateFrom')}</Label>
              <Input
                id="account-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="account-to">{t('statement.dateTo')}</Label>
              <Input
                id="account-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="ml-auto flex gap-2">
              <ExportMenu onExport={handleExport} disabled={!statement} />
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> {t('trade.print')}
              </Button>
            </div>
          </div>

          {!statement ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('statement.date')}</TableHead>
                    <TableHead>{t('statement.document')}</TableHead>
                    <TableHead>{t('common.description')}</TableHead>
                    <TableHead className="text-right">{t('finance.accounts.in')}</TableHead>
                    <TableHead className="text-right">{t('finance.accounts.out')}</TableHead>
                    <TableHead className="text-right">{t('finance.accounts.balance')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={5} className="font-medium">
                      {t('finance.accounts.opening')}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(statement.openingBalance, currency)}
                    </TableCell>
                  </TableRow>
                  {statement.entries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                        {t('finance.accounts.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                  {statement.entries.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className={cn(entry.isReversal && 'text-muted-foreground')}
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatDate(entry.txDate)}
                      </TableCell>
                      <TableCell>
                        <TreasuryDocumentLink entry={entry} />
                        <div className="text-muted-foreground text-xs">
                          {t(`finance.treasuryDocs.${entry.documentType}`)}
                          {entry.isReversal && ` · ${t('finance.accounts.reversal')}`}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-64 text-sm">{entry.description ?? '—'}</TableCell>
                      <TableCell className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">
                        {Number(entry.amountIn) ? formatMoney(entry.amountIn, currency) : ''}
                      </TableCell>
                      <TableCell className="text-destructive text-right tabular-nums">
                        {Number(entry.amountOut) ? formatMoney(entry.amountOut, currency) : ''}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(entry.balance, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/40 hover:bg-muted/40 font-medium">
                    <TableCell colSpan={3}>{t('finance.accounts.closing')}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(statement.totalIn, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(statement.totalOut, currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(statement.closingBalance, currency)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <SimpleFormDialog<EditValues>
        open={editing}
        onOpenChange={setEditing}
        title={t('finance.accounts.edit')}
        schema={editSchema}
        pending={update.isPending}
        onSubmit={onEdit}
        defaultValues={{
          name: account.name,
          bankName: account.bankName ?? '',
          branchName: account.branchName ?? '',
          iban: account.iban ?? '',
          isActive: account.isActive,
        }}
        fields={[
          { name: 'name', label: t('common.name'), wide: true },
          { name: 'bankName', label: t('finance.accounts.bankName') },
          { name: 'branchName', label: t('finance.accounts.branchName') },
          { name: 'iban', label: t('finance.accounts.iban'), wide: true },
          { name: 'isActive', label: t('common.active'), type: 'switch' },
        ]}
      />
    </>
  );
}
