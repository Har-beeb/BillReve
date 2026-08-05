import React, { useState, useEffect } from 'react';
import { Badge } from '../ui';
import { Building2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const WORDS = ['anywhere.', 'anytime.', 'offline.'];

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % WORDS.length);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex bg-white font-inter font-sans">
      
      {/* Left side: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 md:px-24 xl:px-32 relative animate-fade-in bg-white z-10 shadow-[20px_0_40px_-15px_rgba(0,0,0,0.05)]">
        <div className="max-w-md w-full mx-auto">
          {/* Brand */}
          <div className="flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="BillReve Logo" className="w-10 h-10 rounded-2xl bg-white shadow-lg shadow-purple-600/20" />
            <span className="font-['Outfit'] font-black text-3xl tracking-tight text-slate-900 mt-1">BillReve</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">{title}</h2>
          <p className="text-slate-500 mb-5 text-sm">{subtitle}</p>

          {children}
        </div>
      </div>

      {/* Right side: Decorative */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center bg-slate-50">
        
        {/* Animated Background Gradients */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -top-32 -left-32 w-[50rem] h-[50rem] bg-purple-500/20 rounded-full blur-[100px] pointer-events-none" 
        />
        <motion.div 
          animate={{ rotate: -360, scale: [1, 1.3, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-32 -right-32 w-[45rem] h-[45rem] bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none" 
        />
        
        {/* Content Area - No Card, Just Text */}
        <div className="relative z-10 w-full max-w-xl px-8 lg:px-12">
          
          <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-6 shadow-sm">Offline-First Invoicing</Badge>
          
          {/* The title with framer-motion text replacement */}
          <h2 className="text-5xl font-bold mb-6 leading-[1.2] tracking-tight text-slate-900 min-h-[120px]">
             Manage your <br />
             <span className="whitespace-nowrap inline-flex items-center gap-3">
               business
               <div className="relative inline-block w-[250px] h-[60px]">
                 <AnimatePresence mode="popLayout">
                   <motion.span
                     key={wordIndex}
                     initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                     animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                     exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                     transition={{ duration: 0.4, ease: "easeOut" }}
                     className="absolute left-0 top-0 text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 inline-block"
                   >
                     {WORDS[wordIndex]}
                   </motion.span>
                 </AnimatePresence>
               </div>
             </span>
          </h2>
          
          <p className="text-slate-600 text-lg mb-10 leading-relaxed font-light max-w-lg">
             BillReve is the premier offline-first invoicing platform designed for modern SMEs and enterprises. Create quotes, manage clients, and track payments without worrying about internet connectivity.
          </p>

          <div className="space-y-5 max-w-md">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-green-600 shadow-sm border border-slate-100">
                 <CheckCircle2 size={24} />
              </div>
              <div>
                 <h4 className="font-bold text-slate-900">Full Offline Capabilities</h4>
                 <p className="text-sm text-slate-500 mt-0.5">Work seamlessly without a connection.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-slate-100">
                 <Building2 size={24} />
              </div>
              <div>
                 <h4 className="font-bold text-slate-900">Enterprise Ready</h4>
                 <p className="text-sm text-slate-500 mt-0.5">Built to scale with your growing operations.</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
