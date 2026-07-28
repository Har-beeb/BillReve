import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'paid' | 'pending' | 'overdue' | 'draft' | 'accepted' | 'declined' | 'sent' | 'partial' | 'default';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className, ...props }) => {
  const variantStyles = {
    paid: 'text-green-600 dark:text-green-400',
    accepted: 'text-green-600 dark:text-green-400',
    pending: 'text-yellow-600 dark:text-yellow-400',
    partial: 'text-purple-600 dark:text-purple-400',
    sent: 'text-purple-600 dark:text-purple-400',
    overdue: 'text-red-600 dark:text-red-400',
    declined: 'text-red-600 dark:text-red-400',
    draft: 'text-slate-500 dark:text-slate-400',
    default: 'text-slate-800 dark:text-slate-200',
  };

  const dotStyles = {
    paid: 'bg-green-500',
    accepted: 'bg-green-500',
    pending: 'bg-yellow-500',
    partial: 'bg-purple-500',
    sent: 'bg-purple-500',
    overdue: 'bg-red-500',
    declined: 'bg-red-500',
    draft: 'bg-slate-400',
    default: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotStyles[variant])} />
      {children}
    </span>
  );
};
