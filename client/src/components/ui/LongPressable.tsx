import React from 'react';
import { useLongPress } from '../../hooks/useLongPress';

export interface LongPressableProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onLongPress: (e: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onClick: (e: any) => void;
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
    <div {...longPressProps} className={className} style={style}>
      {children}
    </div>
  );
};
