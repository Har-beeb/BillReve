import React, { useEffect, useState } from 'react';

import { Logo } from '../components/ui/Logo';

interface SplashProps {
  onComplete: () => void;
}

const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Stage 0: Initial render (opacity 0 to 1)
    const t1 = setTimeout(() => setStage(1), 100);
    // Stage 1: Reveal complete
    const t2 = setTimeout(() => setStage(2), 2000);
    // Stage 2: Fade out
    const t3 = setTimeout(() => onComplete(), 2500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center overflow-hidden z-50">
      {/* Dynamic Background */}
      <div className="absolute top-0 left-1/4 w-[40rem] h-[40rem] bg-[#9333ea]/10 dark:bg-[#9333ea]/20 rounded-full blur-[100px] pointer-events-none animate-pulse duration-1000" />
      <div className="absolute bottom-0 right-1/4 w-[40rem] h-[40rem] bg-[#4f46e5]/10 dark:bg-[#4f46e5]/20 rounded-full blur-[100px] pointer-events-none animate-pulse duration-1000 delay-500" />

      {/* Main Content */}
      <div 
        className={`relative z-10 flex flex-col items-center transition-all duration-700 ease-out transform
          ${stage === 0 ? 'opacity-0 scale-95 translate-y-4' : ''}
          ${stage === 1 ? 'opacity-100 scale-100 translate-y-0' : ''}
          ${stage === 2 ? 'opacity-0 scale-105 -translate-y-4' : ''}
        `}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-[#a855f7] rounded-2xl blur-xl opacity-30 animate-pulse"></div>
          <div className="relative z-10 transform transition-transform hover:scale-105 duration-300">
             <Logo size="xl" className="!mb-6" />
          </div>
        </div>
        
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
          BillReve
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium tracking-wide">
          SMART INVOICING & QUOTES
        </p>

        {/* Loading Bar */}
        <div className="mt-12 w-48 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#9333ea] to-[#4f46e5] rounded-full animate-progress"></div>
        </div>
      </div>
      
      {/* Define the progress animation locally if not in tailwind */}
      <style>{`
        @keyframes progress {
          0% { width: 0%; transform: translateX(-100%); }
          100% { width: 100%; transform: translateX(100%); }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default Splash;
