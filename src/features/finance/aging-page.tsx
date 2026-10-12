import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFinanceReportsAging } from '@/api/generated/endpoints/finance/finance';
import { AgingSide, type AgingBucketsDto, type AgingRowDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { exportToExcel } from '@/shared/components/data-table/export-excel';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { today } from '@/features/trade/trade-components';

const BUCKETS = ['current', 'd1_30', 'd31_60', 'd61_90', 'd90plus'] as const;

/** Open invoices per partner bucketed by days past due, in the company currency. */
export function AgingPage() {
  const { t } = useTranslation();
  const can = usePermission();
  const [side, setSide] = useState<AgingSide>('RECEIVABLE');
  const [asOf, setAsOf] = useState(today());
  const { data, isLoading } = useFinanceReportsAging({ side, asOf: asOf || undefined });
  const currency = data?.baseCurrency;

  const handleExport = async () => {
    if (!data) return;
    await exportToExcel<AgingRowDto>(
      `aging-${side.toLowerCase()}-${data.asOf}`,
      [
        { header: t('common.code'), value: (r) => r.partnerCode },
        { header: t('trade.partner'), value: (r) => r.partnerTitle },
        { header: t('finance.aging.invoices'), value: (r) => r.invoiceCount },
        { header: t('finance.aging.oldest'), value: (r) => new Date(r.oldestDueDate) },
        ...BUCKETS.map((bucket) => ({
          header: t(`finance.aging.${bucket}`),
          value: (r: AgingRowDto) => Number(r[bucket]),
        })),
        { header: t('finance.aging.total'), value: (r) => Number(r.total) },
      ],
      data.rows,
    );
  };

  const amount = (row: AgingBucketsDto, bucket: (typeof BUCKETS)[number]) => {
    const value = Number(row[bucket]);
    return value ? formatMoney(value, currency) : '';
  };

  return (
    <>
      <PageHeader title={t('finance.aging.title')} description={t('finance.aging.subtitle')} />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label>{t('finance.aging.title')}</Label>
              <Select value={side} onValueChange={(value) => setSide(value as AgingSide)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(AgingSide).map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`finance.aging.${value === 'RECEIVABLE' ? 'receivable' : 'payable'}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="aging-as-of">{t('finance.aging.asOf')}</Label>
              <Input
                id="aging-as-of"
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              className="ml-auto"
              onClick={() => void handleExport()}
              disabled={!data?.rows.length}
            >
              {t('common.export')}
            </Button>
          </div>

          {isLoading || !data ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('trade.partner')}</TableHead>
                    <TableHead className="text-right">{t('finance.aging.invoices')}</TableHead>
                    <TableHead>{t('finance.aging.oldest')}</TableHead>
                    {BUCKETS.map((bucket) => (
                      <TableHead key={bucket} className="text-right whitespace-nowrap">
                        {t(`finance.aging.${bucket}`)}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">{t('finance.aging.total')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">
                        {t('finance.aging.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                  {data.rows.map((row) => (
                    <TableRow key={row.partnerId}>
                      <TableCell>
                        {can('partners:read') ? (
                          <Link
                            to="/partners/$id"
                            params={{ id: row.partnerId }}
                            className="font-medium hover:underline"
                          >
                            {row.partnerTitle}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.partnerTitle}</span>
                        )}
                        <code className="text-muted-foreground block text-xs">
                          {row.partnerCode}
                        </code>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.invoiceCount}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatDate(row.oldestDueDate)}
                      </TableCell>
                      {BUCKETS.map((bucket) => (
                        <TableCell
                          key={bucket}
                          className={cn(
                            'text-right tabular-nums',
                            bucket !== 'current' && Number(row[bucket]) && 'text-destructive',
                          )}
                        >
                          {amount(row, bucket)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(row.total, currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.rows.length > 0 && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40 font-medium">
                      <TableCell colSpan={3}>{t('finance.aging.totals')}</TableCell>
                      {BUCKETS.map((bucket) => (
                        <TableCell key={bucket} className="text-right tabular-nums">
                          {formatMoney(data.totals[bucket], currency)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(data.totals.total, currency)}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
