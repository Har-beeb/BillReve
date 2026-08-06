import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: { outer: 'w-8 h-8 rounded-lg', inner: 'w-4 h-4 rounded-sm' },
    md: { outer: 'w-12 h-12 rounded-xl', inner: 'w-6 h-6 rounded-md' },
    lg: { outer: 'w-16 h-16 rounded-2xl', inner: 'w-8 h-8 rounded-lg' },
    xl: { outer: 'w-24 h-24 rounded-3xl', inner: 'w-12 h-12 rounded-xl' }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div className={`${currentSize.outer} bg-purple-600 dark:bg-purple-600 flex items-center justify-center shadow-md`}>
        <div className={`${currentSize.inner} bg-white dark:bg-white transform rotate-45`}></div>
      </div>
    </div>
  );
};
