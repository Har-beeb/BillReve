import React from 'react';
import { cn } from '../../utils/cn';

interface ProFeatureProps extends React.HTMLAttributes<HTMLDivElement> {
  isProUser: boolean;
  children: React.ReactNode;
}

export const ProFeature: React.FC<ProFeatureProps> = ({ isProUser, children, className, ...props }) => {
  if (isProUser) {
    return <div className={className} {...props}>{children}</div>;
  }

  return (
    <div className={cn('relative group overflow-hidden rounded-xl', className)} {...props}>
      {/* Blurred Content */}
      <div className="blur-[3px] opacity-70 pointer-events-none select-none">
        {children}
      </div>
      {/* Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-auto bg-slate-50/30">
        <span className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap">
          PRO FEATURE
        </span>
      </div>
    </div>
  );
};
