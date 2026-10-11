import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/features/auth/use-session';
import { Field } from '@/shared/components/info-card';

/**
 * Printable document header: company and document identity on top, partner and document facts
 * below. Screen and print share the layout; buttons around it carry `print:hidden`.
 */
export function DocumentHeader({
  title,
  number,
  status,
  partner,
  children,
}: {
  title: string;
  number: string;
  status?: ReactNode;
  partner?: { code?: string; title: string; label?: string } | null;
  /** `Field`s with dates, warehouse, currency and references. */
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const company = me?.companies.find((c) => c.id === me.activeCompanyId);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <div className="text-muted-foreground text-xs uppercase">{title}</div>
          <h1 className="font-mono text-xl font-semibold">{number}</h1>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold">{company?.name}</div>
          <div className="mt-1 print:hidden">{status}</div>
        </div>
      </header>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {partner && (
          <div className="sm:col-span-2">
            <Field label={partner.label ?? t('trade.partner')}>
              <span className="font-medium">{partner.title}</span>
              {partner.code && (
                <code className="text-muted-foreground ml-2 text-xs">{partner.code}</code>
              )}
            </Field>
          </div>
        )}
        {children}
      </dl>
    </div>
  );
}
