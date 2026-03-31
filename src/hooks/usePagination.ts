'use client';

import { useState, useMemo } from 'react';

interface UsePaginationReturn<T> {
  page: number;
  setPage: (p: number) => void;
  pagedItems: T[];
  totalPages: number;
}

/**
 * Reusable pagination hook.
 *
 * Manages page state and slices data automatically.
 * Replaces 5 separate useState/slice patterns in the admin page.
 */
export function usePagination<T>(items: T[], pageSize: number): UsePaginationReturn<T> {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  const pagedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize]
  );

  // Auto-correct if current page exceeds total
  const safePage = page > totalPages ? totalPages : page;
  if (safePage !== page) setPage(safePage);

  return { page, setPage, pagedItems, totalPages };
}
