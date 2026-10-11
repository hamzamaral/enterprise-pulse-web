import type { ReactNode } from 'react';
import { usePermission } from './use-session';

interface CanProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/** Renders children only when the user has the permission. UI hint only; the API enforces it. */
export function Can({ permission, children, fallback = null }: CanProps) {
  const can = usePermission();
  return <>{can(permission) ? children : fallback}</>;
}
