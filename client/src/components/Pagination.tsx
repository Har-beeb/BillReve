import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from './ui';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  className 
}) => {
  const [inputValue, setInputValue] = useState(currentPage.toString());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(currentPage.toString());
  }, [currentPage]);

  const handleInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(inputValue, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
    } else {
      setInputValue(currentPage.toString());
    }
  };

  const getPages = () => {
    const pages = [];
    // Display up to 5 pages
    let startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    if (endPage - startPage < 4) {
      startPage = Math.max(1, endPage - 4);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex flex-col md:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700", className)}>
      <div className="text-sm text-slate-500 dark:text-slate-400">
        Showing page <span className="font-medium text-slate-900 dark:text-slate-100">{currentPage}</span> of <span className="font-medium text-slate-900 dark:text-slate-100">{totalPages}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        
        <div className="flex items-center gap-1">
          {getPages().map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                currentPage === page
                  ? "bg-purple-600 text-white"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              )}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-50 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
        >
          <ChevronRight size={18} />
        </button>

        <form onSubmit={handleInputSubmit} className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200 dark:border-slate-700">
          <label className="text-sm text-slate-500 dark:text-slate-400 hidden sm:block">Go to</label>
          <input
            type="number"
            min={1}
            max={totalPages}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={handleInputSubmit}
            className="w-16 h-8 text-center text-sm border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </form>
      </div>
    </div>
  );
};
