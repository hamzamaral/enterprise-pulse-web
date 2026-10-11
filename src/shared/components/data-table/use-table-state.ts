import type { PaginationState, SortingState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '@/shared/hooks/use-debounced-value';

export interface TableQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Holds server-side table state (page, size, sort, search) and converts it into
 * the query parameters every paginated API endpoint accepts.
 */
export function useTableState(initial?: { pageSize?: number; sort?: SortingState }) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initial?.pageSize ?? 20,
  });
  const [sorting, setSorting] = useState<SortingState>(initial?.sort ?? []);
  const [search, setSearchValue] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const setSearch = (value: string) => {
    setSearchValue(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  };

  const params = useMemo<TableQueryParams>(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      search: debouncedSearch || undefined,
      sortBy: sorting[0]?.id,
      sortOrder: sorting[0] ? (sorting[0].desc ? 'desc' : 'asc') : undefined,
    }),
    [pagination, sorting, debouncedSearch],
  );

  return { pagination, setPagination, sorting, setSorting, search, setSearch, params };
}

export type TableState = ReturnType<typeof useTableState>;
