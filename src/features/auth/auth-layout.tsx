import { Activity, CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher, ThemeToggle } from '@/app/layout/preferences-menu';

const HIGHLIGHTS = [
  'Çoklu şirket ve şube yönetimi',
  'Rol ve izin bazlı yetkilendirme',
  'Çok adımlı onay akışları',
  'Denetim kaydı ve anlık bildirimler',
];

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="from-primary relative hidden flex-col justify-between bg-gradient-to-br to-indigo-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/15">
            <Activity className="size-5" />
          </div>
          {t('app.name')}
        </div>
        <div className="space-y-6">
          <h2 className="text-4xl leading-tight font-semibold">
            Tüm işletmeniz,
            <br />
            tek bir platformda.
          </h2>
          <ul className="space-y-3 text-white/85">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-emerald-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} EnterprisePulse</p>
      </div>

      <div className="relative flex items-center justify-center p-6 md:p-10">
        <div className="absolute top-4 right-4 flex gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-muted-foreground text-sm">{subtitle}</p>}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
