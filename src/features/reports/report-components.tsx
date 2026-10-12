import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import i18n from '@/i18n';
import { formatDate, formatMoney } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';
import { Card, CardContent } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import { type DateRange, matchPreset, presetRange, RANGE_PRESETS } from './date-ranges';

export const CHART_COLORS = {
  primary: 'var(--primary)',
  secondary: 'var(--chart-2)',
  negative: 'var(--destructive)',
  muted: 'var(--muted-foreground)',
} as const;

/** "Eyl 2026" for a "YYYY-MM" period. */
export const monthLabel = (period: string) => formatDate(`${period}-01`, 'MMM yyyy');

/** Short axis labels such as "1,2 Mn". */
export function compactNumber(value: number) {
  return new Intl.NumberFormat(i18n.resolvedLanguage === 'en' ? 'en-US' : 'tr-TR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  const { t } = useTranslation();
  const preset = matchPreset(value);
  return (
    <>
      <div className="space-y-1">
        <Label>{t('reports.ranges.label')}</Label>
        <Select
          value={preset}
          onValueChange={(next) => {
            if (next !== 'custom') onChange(presetRange(next as (typeof RANGE_PRESETS)[number]));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGE_PRESETS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`reports.ranges.${key}`)}
              </SelectItem>
            ))}
            <SelectItem value="custom" disabled>
              {t('reports.ranges.custom')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-from">{t('reports.from')}</Label>
        <Input
          id="report-from"
          type="date"
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="report-to">{t('reports.to')}</Label>
        <Input
          id="report-to"
          type="date"
          value={value.to}
          min={value.from}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        />
      </div>
    </>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode | undefined;
  hint?: ReactNode;
  tone?: 'positive' | 'negative';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-muted-foreground text-sm">{label}</div>
        <div
          className={cn(
            'text-xl font-semibold tabular-nums',
            tone === 'positive' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'negative' && 'text-destructive',
          )}
        >
          {value === undefined ? <Skeleton className="h-7 w-24" /> : value}
        </div>
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </CardContent>
    </Card>
  );
}

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** Drawn as a line on top of the bars. */
  line?: boolean;
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
};

/** Vertical bars per period (optionally with a line series), amounts in `currency`. */
export function PeriodChart<T extends { label: string }>({
  data,
  series,
  currency,
  height = 280,
}: {
  data: T[];
  series: ChartSeries[];
  currency: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
        <YAxis
          tickFormatter={compactNumber}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          width={56}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          formatter={(value) => formatMoney(Number(value), currency)}
        />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) =>
          s.line ? (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              type="linear"
            />
          ) : (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Horizontal bars for a ranking (top partners / products). */
export function RankingChart({
  data,
  label,
  currency,
}: {
  data: { label: string; value: number }[];
  label: string;
  currency: string;
}) {
  const height = Math.max(160, data.length * 32 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          tickFormatter={compactNumber}
          tickLine={false}
          axisLine={false}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={180}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          tickFormatter={(value: string) => (value.length > 26 ? `${value.slice(0, 25)}…` : value)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
          formatter={(value) => formatMoney(Number(value), currency)}
        />
        <Bar
          dataKey="value"
          name={label}
          fill={CHART_COLORS.primary}
          radius={[0, 4, 4, 0]}
          maxBarSize={22}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartSkeleton({ height = 280 }: { height?: number }) {
  return <Skeleton style={{ height }} className="w-full" />;
}
