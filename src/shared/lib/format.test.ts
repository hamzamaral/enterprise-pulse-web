import i18n from '@/i18n';
import { formatDate, formatDateTime, formatMoney, initials } from './format';

describe('format helpers', () => {
  it('formats dates in Turkish order', () => {
    expect(formatDate('2026-10-11T09:30:00')).toBe('11.10.2026');
    expect(formatDateTime('2026-10-11T09:30:00')).toBe('11.10.2026 09:30');
  });

  it('renders a dash for empty values', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatMoney(null)).toBe('—');
  });

  it('formats decimal strings as currency in the active language', async () => {
    await i18n.changeLanguage('tr');
    expect(formatMoney('48500.00')).toBe('₺48.500,00');
    await i18n.changeLanguage('en');
    expect(formatMoney('48500.5')).toBe('₺48,500.50');
  });

  it('builds initials with Turkish casing', () => {
    expect(initials('ilker', 'şahin')).toBe('İŞ');
    expect(initials('Ada')).toBe('A');
  });
});
