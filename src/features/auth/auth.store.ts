import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface AuthState {
  /** Kept in memory only; the refresh token lives in an httpOnly cookie. */
  accessToken: string | null;
  companyId: string | null;
  branchId: string | null;
  setAccessToken: (token: string | null) => void;
  setCompany: (companyId: string, branchId?: string | null) => void;
  setBranch: (branchId: string | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      companyId: null,
      branchId: null,
      setAccessToken: (accessToken) => set({ accessToken }),
      setCompany: (companyId, branchId = null) => set({ companyId, branchId }),
      setBranch: (branchId) => set({ branchId }),
      clear: () => set({ accessToken: null }),
    }),
    {
      name: 'ep-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ companyId: state.companyId, branchId: state.branchId }),
    },
  ),
);
