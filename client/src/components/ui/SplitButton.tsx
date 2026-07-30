import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface SplitButtonProps {
  mainLabel: React.ReactNode;
  onMainClick: () => void;
  options: {
    label: string;
    onClick: () => void;
  }[];
  className?: string;
  align?: 'left' | 'right';
  size?: 'md' | 'lg';
}

export const SplitButton: React.FC<SplitButtonProps> = ({ mainLabel, onMainClick, options, className = '', align = 'right', size = 'md' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const paddingClasses = size === 'lg' ? 'px-3 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base' : 'px-4 py-2 text-sm';
  const iconPaddingClasses = size === 'lg' ? 'px-2 sm:px-3 py-2.5 sm:py-3' : 'px-2 py-2';

  return (
    <div className={`relative inline-flex rounded-lg shadow-sm ${className}`} ref={menuRef}>
      <button
        onClick={onMainClick}
        className={`relative inline-flex items-center justify-center bg-purple-600 hover:bg-purple-700 text-white ${paddingClasses} rounded-l-lg font-medium transition-colors focus:z-10 focus:outline-none focus:ring-2 focus:ring-purple-500 whitespace-nowrap gap-2`}
      >
        {mainLabel}
      </button>
      <div className="relative block">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative inline-flex items-center bg-purple-600 hover:bg-purple-700 text-white ${iconPaddingClasses} rounded-r-lg border-l border-purple-500 transition-colors focus:z-10 focus:outline-none focus:ring-2 focus:ring-purple-500 h-full`}
        >
          <ChevronDown size={size === 'lg' ? 22 : 18} />
        </button>
        {isOpen && (
          <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-slate-800 ring-1 ring-black ring-opacity-5 z-50 overflow-hidden`}>
            <div className="py-1">
              {options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => {
                    option.onClick();
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
