import { Link, type ErrorComponentProps } from '@tanstack/react-router';
import { AlertTriangle, SearchX, ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/api/http';
import { Button } from '@/shared/ui/button';

function ErrorScreen({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message?: string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="bg-muted text-muted-foreground rounded-full p-4">{icon}</div>
      <h1 className="text-xl font-semibold">{title}</h1>
      {message && <p className="text-muted-foreground max-w-md text-sm">{message}</p>}
      <Button asChild variant="outline">
        <Link to="/">{t('errors.goHome')}</Link>
      </Button>
    </div>
  );
}

export function RouteError({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  return (
    <ErrorScreen
      icon={<AlertTriangle className="size-8" />}
      title={t('errors.generic')}
      message={getErrorMessage(error)}
    />
  );
}

export function NotFound() {
  const { t } = useTranslation();
  return <ErrorScreen icon={<SearchX className="size-8" />} title={t('errors.notFound')} />;
}

/** A detail record that does not exist, or that the user may not see. */
export function RecordNotFound() {
  const { t } = useTranslation();
  return (
    <ErrorScreen
      icon={<SearchX className="size-8" />}
      title={t('errors.recordNotFound')}
      message={t('errors.recordNotFoundHint')}
    />
  );
}

export function Forbidden() {
  const { t } = useTranslation();
  return <ErrorScreen icon={<ShieldX className="size-8" />} title={t('errors.forbidden')} />;
}
