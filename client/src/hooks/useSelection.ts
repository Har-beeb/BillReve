import { useState } from 'react';

export function useSelection<T>(items: T[], getId: (item: T) => string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(items.map(getId)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteFromSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  };

  return {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    deleteFromSelection,
    setSelectedIds
  };
}
