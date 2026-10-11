import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { authLogout } from '@/api/generated/endpoints/auth/auth';
import { useAuthStore } from './auth.store';
import { hasPermission, meQueryOptions } from './session';

export function useMe() {
  return useQuery(meQueryOptions());
}

export function usePermission() {
  const { data: me } = useMe();
  return useCallback((code: string) => hasPermission(me, code), [me]);
}

/** Switching company / branch changes every query result, so the cache is reset. */
export function useSwitchContext() {
  const queryClient = useQueryClient();
  const setCompany = useAuthStore((s) => s.setCompany);
  const setBranch = useAuthStore((s) => s.setBranch);

  return {
    switchCompany: async (companyId: string) => {
      setCompany(companyId, null);
      await queryClient.resetQueries();
    },
    switchBranch: async (branchId: string | null) => {
      setBranch(branchId);
      await queryClient.resetQueries();
    },
  };
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async () => {
    try {
      await authLogout();
    } finally {
      useAuthStore.getState().clear();
      queryClient.clear();
      await navigate({ to: '/login' });
    }
  };
}
