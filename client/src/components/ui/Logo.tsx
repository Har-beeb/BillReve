import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: { outer: 'w-8 h-8 rounded-lg', inner: 'w-4 h-4 rounded-sm', margin: 'mb-4' },
    md: { outer: 'w-12 h-12 rounded-xl', inner: 'w-6 h-6 rounded-md', margin: 'mb-8' },
    lg: { outer: 'w-16 h-16 rounded-2xl', inner: 'w-8 h-8 rounded-lg', margin: 'mb-8' },
    xl: { outer: 'w-24 h-24 rounded-3xl', inner: 'w-12 h-12 rounded-xl', margin: 'mb-10' }
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex justify-center ${currentSize.margin} ${className}`}>
      <div className={`${currentSize.outer} bg-white dark:bg-white transform rotate-45 flex items-center justify-center shadow-lg`}>
        <div className={`${currentSize.inner} bg-[#9333ea] dark:bg-[#9333ea]`}></div>
      </div>
    </div>
  );
};
