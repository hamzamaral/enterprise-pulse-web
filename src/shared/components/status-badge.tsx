import { useTranslation } from 'react-i18next';
import { cn } from '@/shared/lib/utils';
import { Badge } from '@/shared/ui/badge';

const tones = {
  success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
  danger: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  neutral: 'bg-muted text-muted-foreground',
  info: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
} as const;

export type Tone = keyof typeof tones;

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn('font-medium', tones[tone])}>
      {children}
    </Badge>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  const { t } = useTranslation();
  return (
    <ToneBadge tone={active ? 'success' : 'neutral'}>
      {active ? t('common.active') : t('common.inactive')}
    </ToneBadge>
  );
}
