import React from 'react';
import { cn } from '../../utils/cn';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn('bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 transition-colors', className)} {...props}>
      {children}
    </div>
  );
};
