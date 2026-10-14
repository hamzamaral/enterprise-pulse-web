import { Link } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useAccountingOptions,
  useLedgerAccountsLedger,
} from '@/api/generated/endpoints/accounting/accounting';
import type { AccountLedgerRowDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import type { DateRange } from '@/features/reports/date-ranges';
import { DateRangeFilter, KpiCard } from '@/features/reports/report-components';
import { useBaseCurrency } from '@/features/trade/trade-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { type ExportFormat, exportTable } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { RecordNotFound } from '@/shared/components/route-error';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { Card, CardContent } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table';
import { AccountTypeBadge, AmountCell, BalanceCell } from './accounting-components';

export interface LedgerSearch extends DateRange {
  partnerId?: string;
}

const ALL = '__all__';

/** Muavin defteri: movements of one account (with its sub-accounts) and the running balance. */
export function AccountLedgerPage({
  id,
  search,
  onSearch,
}: {
  id: string;
  search: LedgerSearch;
  onSearch: (patch: Partial<LedgerSearch>) => void;
}) {
  const { t } = useTranslation();
  const can = usePermission();
  const currency = useBaseCurrency();
  const { data: options } = useAccountingOptions({ query: { enabled: can('accounting:update') } });
  const { data, isLoading } = useLedgerAccountsLedger(id, {
    from: search.from,
    to: search.to,
    partnerId: search.partnerId,
  });

  if (!data) {
    if (!isLoading) return <RecordNotFound />;
    return <Skeleton className="h-96" />;
  }
  const { account } = data;
  const title = `${account.code} ${account.name}`;

  const handleExport = async (format: ExportFormat) => {
    await exportTable<AccountLedgerRowDto>(
      format,
      `ledger-${account.code}-${data.from}-${data.to}`,
      [
        { header: t('accounting.date'), value: (r) => new Date(r.entryDate) },
        { header: t('accounting.journal.number'), value: (r) => r.entryNumber },
        { header: t('accounting.accounts.code'), value: (r) => r.accountCode },
        { header: t('accounting.document'), value: (r) => r.sourceNumber },
        { header: t('accounting.description'), value: (r) => r.lineDescription ?? r.description },
        { header: t('accounting.journal.party'), value: (r) => r.partnerName ?? r.employeeName },
        { header: t('accounting.debit'), value: (r) => Number(r.debit) },
        { header: t('accounting.credit'), value: (r) => Number(r.credit) },
        { header: t('accounting.balance'), value: (r) => Number(r.balance) },
      ],
      data.rows,
      `${title} · ${formatDate(data.from)} – ${formatDate(data.to)}`,
    );
  };

  return (
    <>
      <Link
        to="/accounting/accounts"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {t('accounting.accounts.title')}
      </Link>
      <PageHeader
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <AccountTypeBadge type={account.type} />
            {t('accounting.ledger.subtitle')}
          </span>
        }
        actions={<ExportMenu onExport={handleExport} />}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <DateRangeFilter
            value={{ from: search.from, to: search.to }}
            onChange={(range) => onSearch(range)}
          />
          {options && (
            <div className="space-y-1">
              <Label>{t('accounting.ledger.partner')}</Label>
              <Select
                value={search.partnerId ?? ALL}
                onValueChange={(value) =>
                  onSearch({ partnerId: value === ALL ? undefined : value })
                }
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('accounting.ledger.allPartners')}</SelectItem>
                  {options.partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>
      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t('accounting.ledger.opening')}
          value={<BalanceCell value={data.opening} currency={currency} />}
        />
        <KpiCard
          label={t('accounting.ledger.totalDebit')}
          value={formatMoney(data.totalDebit, currency)}
        />
        <KpiCard
          label={t('accounting.ledger.totalCredit')}
          value={formatMoney(data.totalCredit, currency)}
        />
        <KpiCard
          label={t('accounting.ledger.closing')}
          value={<BalanceCell value={data.closing} currency={currency} />}
        />
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('accounting.date')}</TableHead>
                <TableHead>{t('accounting.journal.number')}</TableHead>
                <TableHead>{t('accounting.description')}</TableHead>
                <TableHead className="text-right">{t('accounting.debit')}</TableHead>
                <TableHead className="text-right">{t('accounting.credit')}</TableHead>
                <TableHead className="text-right">{t('accounting.balance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40">
                <TableCell className="whitespace-nowrap">{formatDate(data.from)}</TableCell>
                <TableCell colSpan={4} className="text-muted-foreground text-sm">
                  {t('accounting.ledger.openingRow')}
                </TableCell>
                <TableCell className="text-right">
                  <BalanceCell value={data.opening} currency={currency} />
                </TableCell>
              </TableRow>
              {data.rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    {t('accounting.ledger.empty')}
                  </TableCell>
                </TableRow>
              )}
              {data.rows.map((row, index) => (
                <TableRow key={`${row.entryId}-${index}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(row.entryDate)}</TableCell>
                  <TableCell>
                    <Link
                      to="/accounting/journal/$id"
                      params={{ id: row.entryId }}
                      className="font-mono text-sm hover:underline"
                    >
                      {row.entryNumber}
                    </Link>
                    {row.accountCode !== account.code && (
                      <span className="text-muted-foreground block font-mono text-xs">
                        {row.accountCode}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="line-clamp-2 text-sm">
                      {row.lineDescription ?? row.description}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {[
                        t(`accounting.source.${row.source}`),
                        row.sourceNumber,
                        row.partnerName ?? row.employeeName,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountCell value={row.debit} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    <AmountCell value={row.credit} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    <BalanceCell value={row.balance} currency={currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  {t('accounting.total')}
                </TableCell>
                <TableCell className="text-right">
                  <AmountCell value={data.totalDebit} currency={currency} strong />
                </TableCell>
                <TableCell className="text-right">
                  <AmountCell value={data.totalCredit} currency={currency} strong />
                </TableCell>
                <TableCell className="text-right">
                  <BalanceCell value={data.closing} currency={currency} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
