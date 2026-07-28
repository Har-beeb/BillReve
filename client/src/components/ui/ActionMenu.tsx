import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface ActionMenuItem {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'danger';
}

export const ActionMenu: React.FC<{ items: ActionMenuItem[] }> = ({ items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updatePosition = () => {
    if (buttonRef.current && isOpen) {
      const rect = buttonRef.current.getBoundingClientRect();
      const right = window.innerWidth - rect.right;
      
      // Calculate top position
      let top = rect.bottom + window.scrollY + 4;
      
      // Check bottom collision
      if (menuRef.current) {
        const menuRect = menuRef.current.getBoundingClientRect();
        if (rect.bottom + menuRect.height > window.innerHeight) {
          // Open upwards instead
          top = rect.top + window.scrollY - menuRect.height - 4;
        }
      } else {
        // Estimate height (approx 36px per item)
        const estimatedHeight = items.length * 36 + 10;
        if (rect.bottom + estimatedHeight > window.innerHeight) {
          top = rect.top + window.scrollY - estimatedHeight - 4;
        }
      }
      
      setMenuStyle({
        top: top,
        right: right,
      });
    }
  };

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Ignore clicks on scrollbars by checking if the click is on the document edge
      if (event.clientX >= document.documentElement.clientWidth || event.clientY >= document.documentElement.clientHeight) {
        return;
      }
      if (
        isOpen && 
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative z-10"
      >
        <MoreVertical size={18} />
      </button>
      
      {isOpen && createPortal(
        <div 
          ref={menuRef}
          style={{ ...menuStyle, zIndex: 999999 }}
          className="absolute w-40 bg-white dark:bg-slate-800 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden py-1"
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
                item.onClick();
              }}
              className={cn(
                "w-full text-left px-4 py-2 text-sm transition-colors",
                item.variant === 'danger' 
                  ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" 
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
