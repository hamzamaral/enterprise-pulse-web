export const RANGE_PRESETS = [
  'thisMonth',
  'lastMonth',
  'thisQuarter',
  'thisYear',
  'lastYear',
  'last12Months',
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface DateRange {
  from: string;
  to: string;
}

/** "YYYY-MM-DD" of a UTC calendar day; day 0 is the last day of the previous month. */
const day = (year: number, month: number, date: number) =>
  new Date(Date.UTC(year, month, date)).toISOString().slice(0, 10);

/** Calendar range of a preset, relative to the local `today`. */
export function presetRange(preset: RangePreset, today = new Date()): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  switch (preset) {
    case 'thisMonth':
      return { from: day(year, month, 1), to: day(year, month + 1, 0) };
    case 'lastMonth':
      return { from: day(year, month - 1, 1), to: day(year, month, 0) };
    case 'thisQuarter': {
      const start = month - (month % 3);
      return { from: day(year, start, 1), to: day(year, start + 3, 0) };
    }
    case 'thisYear':
      return { from: day(year, 0, 1), to: day(year, 11, 31) };
    case 'lastYear':
      return { from: day(year - 1, 0, 1), to: day(year - 1, 11, 31) };
    case 'last12Months':
      return { from: day(year, month - 11, 1), to: day(year, month + 1, 0) };
  }
}

/** The preset a range corresponds to, or "custom". */
export function matchPreset(range: DateRange, today = new Date()): RangePreset | 'custom' {
  return (
    RANGE_PRESETS.find((preset) => {
      const candidate = presetRange(preset, today);
      return candidate.from === range.from && candidate.to === range.to;
    }) ?? 'custom'
  );
}

/** The last `count` months including the current one. */
export function lastMonths(count: number, today = new Date()): DateRange {
  const year = today.getFullYear();
  const month = today.getMonth();
  return { from: day(year, month - count + 1, 1), to: day(year, month + 1, 0) };
}
