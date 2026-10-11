import { MutationCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getErrorMessage } from '@/api/http';

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: {
      /** The caller shows its own error message instead of the global toast. */
      handlesErrors?: boolean;
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status && status < 500) return false;
        return failureCount < 2;
      },
    },
  },
  // Every failed mutation shows the API message; success toasts are handled per feature
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (!mutation.meta?.handlesErrors) toast.error(getErrorMessage(error));
    },
  }),
});
