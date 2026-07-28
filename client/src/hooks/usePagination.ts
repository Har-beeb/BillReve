import { useState, useMemo } from 'react';

export function usePagination<T>(items: T[], itemsPerPage: number = 10) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  
  const paginatedItems = useMemo(() => {
    return items.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  return {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
  };
}
