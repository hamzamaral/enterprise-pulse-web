import { format, formatDistanceToNow, type Locale } from 'date-fns';
import { enUS, tr } from 'date-fns/locale';
import i18n from '@/i18n';

const locales: Record<string, Locale> = { tr, en: enUS };
const currentLocale = () => locales[i18n.resolvedLanguage ?? 'tr'] ?? tr;

export function formatDate(
  value: string | Date | null | undefined,
  pattern = 'dd.MM.yyyy',
): string {
  if (!value) return '—';
  return format(new Date(value), pattern, { locale: currentLocale() });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, 'dd.MM.yyyy HH:mm');
}

export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: currentLocale() });
}

export function initials(firstName?: string, lastName?: string): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toLocaleUpperCase('tr');
}
