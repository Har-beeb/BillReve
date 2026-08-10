import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <img 
        src="/logo.png" 
        alt="BillReve Logo" 
        className={`${currentSize} object-contain`} 
      />
    </div>
  );
};
