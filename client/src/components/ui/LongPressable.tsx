import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';

export interface LongPressableProps {
  onLongPress: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick: (e: React.PointerEvent<HTMLDivElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const LongPressable: React.FC<LongPressableProps> = ({ 
  onLongPress, 
  onClick, 
  className, 
  style,
  children 
}) => {
  const longPressProps = useLongPress(onLongPress, onClick);
  
  return (
    <div
      {...longPressProps}
      className={`select-none touch-manipulation ${className || ''}`}
      style={{ userSelect: 'none', WebkitUserSelect: 'none', ...style }}
    >
      {children}
    </div>
  );
};

export const SelectionIndicator: React.FC<{ selected: boolean; onClick: (event: React.MouseEvent<HTMLButtonElement>) => void }> = ({ selected, onClick }) => (
  <button
    type="button"
    aria-label={selected ? 'Deselect item' : 'Select item'}
    onClick={onClick}
    className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] leading-none transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1 dark:focus:ring-offset-slate-800 ${
      selected
        ? 'border-purple-600 bg-purple-600 text-white'
        : 'border-slate-300 bg-white text-transparent hover:border-purple-400 dark:border-slate-600 dark:bg-slate-800'
    }`}
  >
    {selected ? '✓' : ''}
  </button>
);
