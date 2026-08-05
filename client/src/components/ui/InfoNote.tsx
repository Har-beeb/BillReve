import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

interface InfoNoteProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  variant?: 'info' | 'warning' | 'success';
  className?: string;
}

const InfoNote: React.FC<InfoNoteProps> = ({ title, children, defaultExpanded = false, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl overflow-hidden transition-all duration-200 ${className}`}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-blue-100/50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
          <Info size={20} />
          <span className="font-semibold text-sm">{title}</span>
        </div>
        <div className="text-blue-500 dark:text-blue-400">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-4 text-sm text-slate-700 dark:text-slate-300">
          {children}
        </div>
      )}
    </div>
  );
};

export default InfoNote;
