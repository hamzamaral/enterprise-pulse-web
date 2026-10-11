import { Printer } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePartnersStatement } from '@/api/generated/endpoints/partners/partners';
import type { StatementEntryDto } from '@/api/generated/model';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { DocumentLink } from '@/features/trade/document-link';
import { BalanceText } from './partner-components';

const startOfYear = () => `${new Date().getFullYear()}-01-01`;

/** Cari ekstre: opening balance, entries with running balance, closing balance. */
export function PartnerStatement({ partnerId }: { partnerId: string }) {
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState(startOfYear());
  const [dateTo, setDateTo] = useState('');
  const { data, isLoading } = usePartnersStatement(partnerId, {
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const handleExport = async () => {
    if (!data) return;
    await exportToExcel<StatementEntryDto>(
      `statement-${data.code}`,
      [
        { header: t('statement.date'), value: (e) => new Date(e.entryDate) },
        { header: t('statement.document'), value: (e) => e.documentNumber },
        {
          header: t('statement.documentType'),
          value: (e) => t(`statement.documentTypes.${e.documentType}`),
        },
        { header: t('common.description'), value: (e) => e.description },
        { header: t('statement.dueDate'), value: (e) => (e.dueDate ? new Date(e.dueDate) : null) },
        { header: t('statement.currency'), value: (e) => e.currencyCode },
        { header: t('statement.debit'), value: (e) => Number(e.debitBase) },
        { header: t('statement.credit'), value: (e) => Number(e.creditBase) },
        { header: t('statement.balance'), value: (e) => Number(e.balance) },
      ],
      data.entries,
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="statement-from">{t('statement.dateFrom')}</Label>
          <Input
            id="statement-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="statement-to">{t('statement.dateTo')}</Label>
          <Input
            id="statement-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={() => void handleExport()} disabled={!data}>
            {t('common.export')}
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer /> {t('statement.print')}
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <Skeleton className="h-48" />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('statement.date')}</TableHead>
                <TableHead>{t('statement.document')}</TableHead>
                <TableHead>{t('common.description')}</TableHead>
                <TableHead>{t('statement.dueDate')}</TableHead>
                <TableHead className="text-right">{t('statement.debit')}</TableHead>
                <TableHead className="text-right">{t('statement.credit')}</TableHead>
                <TableHead className="text-right">{t('statement.balance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableCell colSpan={6} className="font-medium">
                  {t('statement.opening')}
                </TableCell>
                <TableCell className="text-right">
                  <BalanceText value={data.openingBalance} />
                </TableCell>
              </TableRow>
              {data.entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    {t('statement.empty')}
                  </TableCell>
                </TableRow>
              )}
              {data.entries.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={cn(entry.isReversal && 'text-muted-foreground')}
                >
                  <TableCell className="whitespace-nowrap">{formatDate(entry.entryDate)}</TableCell>
                  <TableCell>
                    <DocumentLink
                      type={entry.documentType}
                      id={entry.documentId}
                      number={entry.documentNumber}
                    />
                    <div className="text-muted-foreground text-xs">
                      {t(`statement.documentTypes.${entry.documentType}`)}
                      {entry.isReversal && ` · ${t('statement.reversal')}`}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-64 text-sm">
                    {entry.description ?? '—'}
                    {entry.currencyCode !== data.baseCurrency && (
                      <div className="text-muted-foreground text-xs tabular-nums">
                        {formatMoney(
                          Number(entry.debit) || Number(entry.credit),
                          entry.currencyCode,
                        )}{' '}
                        × {entry.exchangeRate}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(entry.dueDate)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(entry.debitBase) ? formatMoney(entry.debitBase, data.baseCurrency) : ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {Number(entry.creditBase)
                      ? formatMoney(entry.creditBase, data.baseCurrency)
                      : ''}
                  </TableCell>
                  <TableCell className="text-right">
                    <BalanceText value={entry.balance} currency={data.baseCurrency} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/40 hover:bg-muted/40 font-medium">
                <TableCell colSpan={4}>{t('statement.closing')}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totalDebit, data.baseCurrency)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(data.totalCredit, data.baseCurrency)}
                </TableCell>
                <TableCell className="text-right">
                  <BalanceText value={data.closingBalance} currency={data.baseCurrency} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
