import React, { useState, useEffect } from 'react';
import { Badge } from '../ui';
import { Building2, CheckCircle2, Moon, Sun } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const WORDS = ['anywhere.', 'anytime.', 'offline.'];

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const [wordIndex, setWordIndex] = useState(0);
  const { theme, toggleTheme } = useAppStore();

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % WORDS.length);
    }, 2500); // Change word every 2.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex bg-white dark:bg-slate-900 font-inter font-sans">
      
      {/* Left side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 xl:px-32 relative animate-fade-in bg-white dark:bg-slate-900 z-10 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-none">
        
        {/* Theme Toggle for Login Page */}
        <div className="absolute top-6 right-6 sm:top-8 sm:right-8">
          <button 
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="max-w-md w-full mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="BillReve Logo" className="w-10 h-10 rounded-2xl bg-white shadow-lg shadow-purple-600/20" />
            <span className="font-['Outfit'] font-black text-3xl tracking-tight text-slate-900 dark:text-white mt-1">BillReve</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{title}</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-5 text-sm">{subtitle}</p>

          {children}
        </div>
      </div>

      <div className="hidden lg:flex w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
           <img 
             src="https://images.unsplash.com/photo-1554774853-719586f82d77?ixlib=rb-4.0.3&auto=format&fit=crop&w=1600&q=80" 
             alt="Office working" 
             className="w-full h-full object-cover opacity-20 mix-blend-overlay"
           />
           <div className="absolute inset-0 bg-gradient-to-br from-purple-900/95 via-slate-900/95 to-slate-900"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 w-full max-w-xl px-8 lg:px-12 text-white animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          <Badge className="bg-white/10 text-white border-white/20 mb-6 backdrop-blur-md">Offline-First Invoice Management</Badge>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight min-h-[120px] md:min-h-[144px]">
             Manage your <br />
             business{' '}
             <span key={WORDS[wordIndex]} className="text-purple-400 inline-block animate-fade-in-up">
                {WORDS[wordIndex]}
             </span>
          </h2>
          
          <p className="text-slate-300 text-lg mb-8 leading-relaxed font-light">
             BillReve is the premier offline-first invoicing platform designed for modern SMEs and enterprises. Create quotes, manage clients, and track payments without worrying about internet connectivity.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-xl shadow-purple-900/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white">
                 <CheckCircle2 size={20} />
              </div>
              <div>
                 <h4 className="font-medium text-white text-sm">Full Offline Capabilities</h4>
                 <p className="text-xs text-purple-100 mt-0.5">Work seamlessly without a connection.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-xl shadow-purple-900/20">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white">
                 <Building2 size={20} />
              </div>
              <div>
                 <h4 className="font-medium text-white text-sm">Enterprise Ready</h4>
                 <p className="text-xs text-purple-100 mt-0.5">Built to scale with your growing operations.</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20 pointer-events-none"></div>
      </div>
    </div>
  );
};

export default AuthLayout;
