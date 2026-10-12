import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePartnersFindOne } from '@/api/generated/endpoints/partners/partners';
import { useReportsPurchases, useReportsSales } from '@/api/generated/endpoints/reports/reports';
import { TradeReportGroupBy, type TradeReportRowDto } from '@/api/generated/model';
import { usePermission } from '@/features/auth/use-session';
import { PartnerPicker } from '@/features/partners/partner-components';
import { ExportMenu } from '@/shared/components/data-table/export-menu';
import { type ExportFormat, exportTable } from '@/shared/components/data-table/export-table';
import { PageHeader } from '@/shared/components/page-header';
import { formatDate, formatMoney, formatQuantity } from '@/shared/lib/format';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Label } from '@/shared/ui/label';
import { Skeleton } from '@/shared/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import type { DateRange } from './date-ranges';
import {
  CHART_COLORS,
  ChartSkeleton,
  DateRangeFilter,
  KpiCard,
  monthLabel,
  PeriodChart,
  RankingChart,
} from './report-components';

export type TradeSide = 'sales' | 'purchases';

export interface TradeReportSearch extends DateRange {
  groupBy: TradeReportGroupBy;
  partnerId?: string;
}

/** Sales or purchase analysis grouped by month, partner or product. */
export function TradeReportPage({
  side,
  search,
  onSearch,
}: {
  side: TradeSide;
  search: TradeReportSearch;
  onSearch: (patch: Partial<TradeReportSearch>) => void;
}) {
  const { t } = useTranslation();
  const can = usePermission();
  const sales = side === 'sales';
  const { groupBy, partnerId } = search;
  const params = { from: search.from, to: search.to, groupBy, partnerId };
  const salesReport = useReportsSales(params, { query: { enabled: sales } });
  const purchaseReport = useReportsPurchases(params, { query: { enabled: !sales } });
  const { data, isLoading } = sales ? salesReport : purchaseReport;
  const { data: partner } = usePartnersFindOne(partnerId ?? '', {
    query: { enabled: !!partnerId },
  });
  const currency = data?.currencyCode ?? 'TRY';
  const rows = data?.rows ?? [];
  const byMonth = groupBy === TradeReportGroupBy.MONTH;
  const byProduct = groupBy === TradeReportGroupBy.PRODUCT;
  const title = t(`reports.${side}.title`);

  const rowLabel = (row: TradeReportRowDto) => (byMonth ? monthLabel(row.key) : row.label);
  const money = (value: string) => formatMoney(value, currency);

  const handleExport = async (format: ExportFormat) => {
    await exportTable<TradeReportRowDto>(
      format,
      `${side}-report-${search.from}-${search.to}`,
      [
        ...(byMonth ? [] : [{ header: t('common.code'), value: (r: TradeReportRowDto) => r.code }]),
        { header: t(`reports.columns.${groupBy}`), value: rowLabel },
        { header: t('reports.columns.documents'), value: (r) => r.documentCount },
        ...(byProduct
          ? [
              {
                header: t('reports.columns.quantity'),
                value: (r: TradeReportRowDto) => Number(r.quantity),
              },
            ]
          : []),
        { header: t('reports.columns.net'), value: (r) => Number(r.net) },
        { header: t('reports.columns.vat'), value: (r) => Number(r.vat) },
        { header: t('reports.columns.gross'), value: (r) => Number(r.gross) },
        ...(sales
          ? [
              {
                header: t('reports.columns.returns'),
                value: (r: TradeReportRowDto) => Number(r.returns),
              },
            ]
          : []),
        { header: t('reports.columns.netTotal'), value: (r) => Number(r.netTotal) },
      ],
      rows,
      `${title} · ${formatDate(search.from)} – ${formatDate(search.to)}`,
    );
  };

  const chart = byMonth ? (
    <PeriodChart
      currency={currency}
      data={rows.map((row) => ({
        label: monthLabel(row.key),
        netTotal: Number(row.netTotal),
        returns: Number(row.returns),
      }))}
      series={[
        { key: 'netTotal', label: t(`reports.${side}.netLabel`), color: CHART_COLORS.primary },
        ...(sales
          ? [{ key: 'returns', label: t('reports.columns.returns'), color: CHART_COLORS.negative }]
          : []),
      ]}
    />
  ) : (
    <RankingChart
      currency={currency}
      label={t(`reports.${side}.netLabel`)}
      data={rows.slice(0, 10).map((row) => ({ label: row.label, value: Number(row.netTotal) }))}
    />
  );

  const columnCount = 6 + (byProduct ? 1 : 0) + (sales ? 1 : 0);

  return (
    <>
      <PageHeader
        title={title}
        description={t(`reports.${side}.subtitle`)}
        actions={<ExportMenu onExport={handleExport} disabled={!rows.length} />}
      />
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <DateRangeFilter
            value={{ from: search.from, to: search.to }}
            onChange={(range) => onSearch(range)}
          />
          <div className="w-72 space-y-1">
            <Label>{t(`reports.${side}.partner`)}</Label>
            <div className="flex gap-1">
              <PartnerPicker
                value={partnerId && partner ? partner : null}
                type={sales ? 'CUSTOMER' : 'SUPPLIER'}
                onChange={(picked) => onSearch({ partnerId: picked.id })}
              />
              {partnerId && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.clear')}
                  onClick={() => onSearch({ partnerId: undefined })}
                >
                  <X />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <Label>{t('reports.groupBy.label')}</Label>
            <Tabs
              value={groupBy}
              onValueChange={(value) => onSearch({ groupBy: value as TradeReportGroupBy })}
            >
              <TabsList>
                {Object.values(TradeReportGroupBy).map((value) => (
                  <TabsTrigger key={value} value={value}>
                    {t(`reports.groupBy.${value}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={t(`reports.${side}.netLabel`)}
          value={data && money(data.totals.netTotal)}
          hint={data && t('reports.documentsHint', { count: data.totals.documentCount })}
        />
        <KpiCard label={t('reports.columns.vat')} value={data && money(data.totals.vat)} />
        <KpiCard label={t('reports.columns.gross')} value={data && money(data.totals.gross)} />
        {sales ? (
          <KpiCard
            label={t('reports.columns.returns')}
            value={data && money(data.totals.returns)}
            tone={data && Number(data.totals.returns) ? 'negative' : undefined}
          />
        ) : (
          <KpiCard label={t('reports.columns.documents')} value={data?.totals.documentCount} />
        )}
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="text-base">
            {byMonth
              ? t('reports.trend')
              : t('reports.top', { group: t(`reports.groupBy.${groupBy}`) })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <ChartSkeleton />
          ) : rows.length && Number(data.totals.gross) ? (
            chart
          ) : (
            <p className="text-muted-foreground py-12 text-center text-sm">{t('reports.empty')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading || !data ? (
            <Skeleton className="h-48" />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(`reports.columns.${groupBy}`)}</TableHead>
                    <TableHead className="text-right">{t('reports.columns.documents')}</TableHead>
                    {byProduct && (
                      <TableHead className="text-right">{t('reports.columns.quantity')}</TableHead>
                    )}
                    <TableHead className="text-right">{t('reports.columns.net')}</TableHead>
                    <TableHead className="text-right">{t('reports.columns.vat')}</TableHead>
                    <TableHead className="text-right">{t('reports.columns.gross')}</TableHead>
                    {sales && (
                      <TableHead className="text-right">{t('reports.columns.returns')}</TableHead>
                    )}
                    <TableHead className="text-right">{t('reports.columns.netTotal')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={columnCount}
                        className="text-muted-foreground py-8 text-center"
                      >
                        {t('reports.empty')}
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((row) => (
                    <TableRow
                      key={row.key}
                      className={row.documentCount ? '' : 'text-muted-foreground'}
                    >
                      <TableCell>
                        {groupBy === TradeReportGroupBy.PARTNER && can('partners:read') ? (
                          <Link
                            to="/partners/$id"
                            params={{ id: row.key }}
                            className="font-medium hover:underline"
                          >
                            {row.label}
                          </Link>
                        ) : (
                          <span className="font-medium">{rowLabel(row)}</span>
                        )}
                        {row.code && (
                          <code className="text-muted-foreground block text-xs">{row.code}</code>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.documentCount}</TableCell>
                      {byProduct && (
                        <TableCell className="text-right tabular-nums">
                          {formatQuantity(row.quantity)}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">{money(row.net)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.vat)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(row.gross)}</TableCell>
                      {sales && (
                        <TableCell className="text-destructive text-right tabular-nums">
                          {Number(row.returns) ? money(row.returns) : ''}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium tabular-nums">
                        {money(row.netTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length > 0 && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40 font-medium">
                      <TableCell>{t('reports.totals')}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {data.totals.documentCount}
                      </TableCell>
                      {byProduct && <TableCell />}
                      <TableCell className="text-right tabular-nums">
                        {money(data.totals.net)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(data.totals.vat)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(data.totals.gross)}
                      </TableCell>
                      {sales && (
                        <TableCell className="text-right tabular-nums">
                          {money(data.totals.returns)}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">
                        {money(data.totals.netTotal)}
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
