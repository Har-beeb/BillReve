import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300); // match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isRendered) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      
      {/* Sheet Content */}
      <div 
        className={`relative bg-white dark:bg-slate-800 w-full rounded-t-2xl shadow-xl transition-transform duration-300 transform ${isVisible ? 'translate-y-0' : 'translate-y-full'} max-h-[90vh] flex flex-col`}
      >
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700/50">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">
            {title || 'Menu'}
          </h3>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto pb-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
