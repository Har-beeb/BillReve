import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import InfoNote from '../ui/InfoNote';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const { theme, toggleTheme } = useAppStore();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 font-inter font-sans py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      
      {/* Theme Toggle for Login Page */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20">
        <button 
          onClick={toggleTheme}
          className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-sm bg-white dark:bg-slate-900"
          title="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <div className="max-w-md w-full space-y-6 bg-white dark:bg-slate-900 p-8 sm:p-10 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 relative z-10 animate-fade-in">
        
        {/* Brand */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.png" alt="BillReve Logo" className="w-12 h-12 rounded-2xl shadow-lg shadow-purple-600/20 bg-white" />
            <span className="font-['Outfit'] font-black text-4xl tracking-tight text-slate-900 dark:text-white mt-1">BillReve</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">{title}</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-2 text-sm">{subtitle}</p>
        </div>

        <InfoNote 
          title="Offline-First Capabilities" 
          variant="info" 
          defaultExpanded={false}
          className="mb-6"
        >
          <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 mt-2">
            <p>BillReve is designed to work seamlessly even without an internet connection.</p>
            <ul className="list-disc pl-5 space-y-1">
               <li>Create quotes, manage clients, and track payments offline.</li>
               <li>Changes sync automatically when you reconnect.</li>
               <li>Built to scale with enterprise-ready features.</li>
            </ul>
          </div>
        </InfoNote>

        {children}
      </div>

      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-72 h-72 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-10 pointer-events-none"></div>
    </div>
  );
};

export default AuthLayout;
