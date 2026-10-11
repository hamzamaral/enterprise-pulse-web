import type { QueryClient } from '@tanstack/react-query';
import { redirect } from '@tanstack/react-router';
import { getAuthMeQueryOptions } from '@/api/generated/endpoints/auth/auth';
import type { MeResponseDto } from '@/api/generated/model';
import { refreshAccessToken } from '@/api/http';
import { useAuthStore } from './auth.store';

export const meQueryOptions = () =>
  getAuthMeQueryOptions({ query: { staleTime: 5 * 60_000, retry: false } });

/** A list of codes means any one of them is enough. */
export function hasPermission(
  me: MeResponseDto | undefined,
  code: string | readonly string[],
): boolean {
  if (!me) return false;
  const codes = typeof code === 'string' ? [code] : code;
  return me.user.isSuperAdmin || codes.some((c) => me.permissions.includes(c));
}

/**
 * Restores the session on first load (refresh cookie -> access token), loads `/auth/me`
 * and makes sure the persisted company / branch selection is still valid.
 */
export async function ensureSession(queryClient: QueryClient, redirectTo: string) {
  const store = useAuthStore.getState();
  if (!store.accessToken) {
    const token = await refreshAccessToken();
    if (!token) throw redirect({ to: '/login', search: { redirect: redirectTo } });
  }

  let me: MeResponseDto;
  try {
    me = await queryClient.ensureQueryData(meQueryOptions());
  } catch {
    // Persisted company may no longer be accessible: reset it and retry once
    useAuthStore.setState({ companyId: null, branchId: null });
    try {
      me = await queryClient.fetchQuery(meQueryOptions());
    } catch {
      useAuthStore.getState().clear();
      throw redirect({ to: '/login', search: { redirect: redirectTo } });
    }
  }

  const { companyId, branchId } = useAuthStore.getState();
  if (companyId !== me.activeCompanyId || (branchId ?? null) !== (me.activeBranchId ?? null)) {
    useAuthStore.setState({ companyId: me.activeCompanyId, branchId: me.activeBranchId ?? null });
  }
  return me;
}

/** Route guard: `beforeLoad: requirePermission('users:read')`. */
export function requirePermission(code: string | readonly string[]) {
  return ({ context }: { context: { queryClient: QueryClient } }) => {
    const me = context.queryClient.getQueryData(meQueryOptions().queryKey);
    if (!hasPermission(me, code)) throw redirect({ to: '/forbidden' });
  };
}
