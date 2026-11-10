import React from 'react';
import { Info, AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

export type InstructionNoteType = 'info' | 'warning' | 'error' | 'success';

interface InstructionNoteProps {
  type?: InstructionNoteType;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const config = {
  info: {
    icon: Info,
    containerClass: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/60 text-purple-800 dark:text-purple-200',
    iconClass: 'text-purple-500 dark:text-purple-300',
    titleClass: 'text-purple-900 dark:text-purple-100',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'bg-amber-50 border-amber-200 text-amber-800',
    iconClass: 'text-amber-500',
    titleClass: 'text-amber-900',
  },
  error: {
    icon: AlertCircle,
    containerClass: 'bg-red-50 border-red-200 text-red-800',
    iconClass: 'text-red-500',
    titleClass: 'text-red-900',
  },
  success: {
    icon: CheckCircle2,
    containerClass: 'bg-green-50 border-green-200 text-green-800',
    iconClass: 'text-green-500',
    titleClass: 'text-green-900',
  },
};

export const InstructionNote: React.FC<InstructionNoteProps> = ({ 
  type = 'info', 
  title, 
  children, 
  className = '' 
}) => {
  const { icon: Icon, containerClass, iconClass, titleClass } = config[type];

  return (
    <div className={`p-4 rounded-xl border flex gap-3 ${containerClass} ${className}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconClass}`} />
      <div className="flex-1 text-sm">
        {title && <h4 className={`font-semibold mb-1 ${titleClass}`}>{title}</h4>}
        <div className="leading-relaxed whitespace-pre-wrap opacity-90">
          {children}
        </div>
      </div>
    </div>
  );
};
