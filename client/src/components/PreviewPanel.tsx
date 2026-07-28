import React from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { cn } from './ui';

interface PreviewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  children,
  actions 
}) => {
  // Render the panel inside a Portal so it attaches to document.body.
  // This prevents parent transform animations (like page transitions)
  // from breaking 'fixed' positioning.
  const panelContent = (
    <>
      {/* Backdrop (Visible on mobile, transparent on desktop) */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/20 md:bg-transparent z-30"
          onClick={onClose}
        />
      )}
      
      {/* Sliding Panel */}
      <div 
        className={cn(
          "fixed top-16 right-0 bottom-0 md:bottom-auto w-[90%] md:w-[450px] bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700 z-40 transform transition-transform duration-300 flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full",
          // On desktop, it takes full height minus header.
          "md:h-[calc(100vh-64px)]"
        )}
      >
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">{title}</h2>
          <div className="flex items-center gap-2">
            {actions}
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {children}
        </div>
      </div>
    </>
  );

  // Use document.body to render portal if available
  if (typeof document !== 'undefined') {
    return createPortal(panelContent, document.body);
  }
  
  return panelContent;
};
