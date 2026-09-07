import React from 'react';
import { cn } from '../../utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'paid' | 'pending' | 'overdue' | 'draft' | 'accepted' | 'declined' | 'sent' | 'partial' | 'countered' | 'expired' | 'default';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', children, className, ...props }) => {
  const variantStyles: Record<string, string> = {
    paid: 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    accepted: 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    pending: 'bg-amber-100/80 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
    partial: 'bg-purple-100/80 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400 border-purple-200 dark:border-purple-500/30',
    sent: 'bg-blue-100/80 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border-blue-200 dark:border-blue-500/30',
    overdue: 'bg-rose-100/80 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    declined: 'bg-rose-100/80 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
    countered: 'bg-orange-100/80 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400 border-orange-200 dark:border-orange-500/30',
    expired: 'bg-slate-200/80 text-slate-700 dark:bg-slate-600/30 dark:text-slate-300 border-slate-300 dark:border-slate-500/30',
    draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-300 border-slate-200 dark:border-slate-600',
    default: 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-200 border-slate-200 dark:border-slate-600',
  };

  const dotStyles: Record<string, string> = {
    paid: 'bg-emerald-500',
    accepted: 'bg-emerald-500',
    pending: 'bg-amber-500',
    partial: 'bg-purple-500',
    sent: 'bg-blue-500',
    overdue: 'bg-rose-500',
    declined: 'bg-rose-500',
    countered: 'bg-orange-500',
    expired: 'bg-slate-500',
    draft: 'bg-slate-400',
    default: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider rounded-full border',
        variantStyles[variant] || variantStyles.default,
        className
      )}
      {...props}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full", dotStyles[variant] || dotStyles.default)} />
      {children}
    </span>
  );
};
