import { formatDate, formatDateTime, initials } from './format';

describe('format helpers', () => {
  it('formats dates in Turkish order', () => {
    expect(formatDate('2026-10-11T09:30:00')).toBe('11.10.2026');
    expect(formatDateTime('2026-10-11T09:30:00')).toBe('11.10.2026 09:30');
  });

  it('renders a dash for empty values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
  });

  it('builds initials with Turkish casing', () => {
    expect(initials('ilker', 'şahin')).toBe('İŞ');
    expect(initials('Ada')).toBe('A');
  });
});
