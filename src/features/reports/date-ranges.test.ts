import { lastMonths, matchPreset, presetRange } from './date-ranges';

const today = new Date(2026, 1, 14); // 14 Feb 2026, local time

describe('presetRange', () => {
  it('covers whole calendar months', () => {
    expect(presetRange('thisMonth', today)).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetRange('lastMonth', today)).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('crosses the year boundary', () => {
    expect(presetRange('lastMonth', new Date(2026, 0, 5))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(presetRange('last12Months', today)).toEqual({ from: '2025-03-01', to: '2026-02-28' });
  });

  it('finds the quarter and the year', () => {
    expect(presetRange('thisQuarter', new Date(2026, 7, 20))).toEqual({
      from: '2026-07-01',
      to: '2026-09-30',
    });
    expect(presetRange('thisYear', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(presetRange('lastYear', today)).toEqual({ from: '2025-01-01', to: '2025-12-31' });
  });
});

describe('matchPreset', () => {
  it('recognises a preset range and falls back to custom', () => {
    expect(matchPreset({ from: '2026-01-01', to: '2026-12-31' }, today)).toBe('thisYear');
    expect(matchPreset({ from: '2026-01-02', to: '2026-12-31' }, today)).toBe('custom');
  });
});

describe('lastMonths', () => {
  it('ends with the current month', () => {
    expect(lastMonths(6, today)).toEqual({ from: '2025-09-01', to: '2026-02-28' });
  });
});
