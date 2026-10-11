import { keepPreviousData, useQueryClient, type QueryKey } from '@tanstack/react-query';

/** Keeps the previous page visible while the next one loads (no table flicker). */
export const tableQuery = { placeholderData: keepPreviousData } as const;

export function useInvalidate() {
  const queryClient = useQueryClient();
  return (...keys: QueryKey[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

/** Loads every page of a paginated endpoint, e.g. for Excel export. */
export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; meta: { totalPages: number } }>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const rest = await Promise.all(
    Array.from({ length: first.meta.totalPages - 1 }, (_, i) => fetchPage(i + 2)),
  );
  return [first, ...rest].flatMap((page) => page.data);
}
