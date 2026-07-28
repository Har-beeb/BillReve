import React from 'react';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 h-full min-h-[400px]">
      <div className="w-24 h-24 bg-purple-50 text-purple-500 dark:bg-slate-700/50 dark:text-purple-400 rounded-full flex items-center justify-center mb-6 shadow-sm border border-purple-100/50 dark:border-slate-700">
        <Icon size={48} strokeWidth={1.5} />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">
        {title}
      </h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8 leading-relaxed">
        {description}
      </p>
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
