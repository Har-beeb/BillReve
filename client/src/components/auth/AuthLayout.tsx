import React, { useState, useEffect } from 'react';
import { Badge } from '../ui';
import { Building2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '../ui/Logo';

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
          <div className="flex items-center gap-3 mb-6">
            <Logo size="sm" className="!mb-0" />
            <span className="font-['Outfit'] font-black text-2xl tracking-tight text-slate-900">BillReve</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">{title}</h2>
          <p className="text-slate-500 mb-5 text-sm">{subtitle}</p>

          {children}
        </div>
      </div>

      {/* Right side: Decorative Premium SaaS Side */}
      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center bg-slate-950">
        
        {/* Animated Background Gradients - Richer colors for dark mode */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute -top-40 -left-40 w-[60rem] h-[60rem] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" 
        />
        <motion.div 
          animate={{ rotate: -360, scale: [1, 1.3, 1] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-40 -right-40 w-[55rem] h-[55rem] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" 
        />
        
        {/* Abstract Grid Overlay */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-soft-light pointer-events-none"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        
        {/* Content Area */}
        <div className="relative z-10 w-full max-w-xl px-8 lg:px-12">
          
          <Badge className="bg-white/10 text-white border-white/20 mb-8 backdrop-blur-md px-4 py-1.5 shadow-xl">
             <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                Next-Gen Invoicing
             </span>
          </Badge>
          
          {/* Fixed the title wrapping by breaking it naturally and using wait mode */}
          <h2 className="text-5xl xl:text-6xl font-extrabold mb-6 leading-[1.1] tracking-tight text-white min-h-[140px]">
             Manage your business <br />
             <div className="relative h-[80px] mt-2 block w-full">
               <AnimatePresence mode="wait">
                 <motion.span
                   key={wordIndex}
                   initial={{ opacity: 0, y: 20, filter: "blur(10px)" }}
                   animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                   exit={{ opacity: 0, y: -20, filter: "blur(10px)" }}
                   transition={{ duration: 0.4, ease: "easeInOut" }}
                   className="absolute left-0 top-0 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-400 to-indigo-400"
                 >
                   {WORDS[wordIndex]}
                 </motion.span>
               </AnimatePresence>
             </div>
          </h2>
          
          <p className="text-slate-300 text-lg mb-12 leading-relaxed font-light max-w-lg">
             BillReve is the premier offline-first invoicing platform designed for modern SMEs and enterprises. Create quotes, manage clients, and track payments without worrying about internet connectivity.
          </p>

          <div className="space-y-6 max-w-md relative before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/5 before:to-transparent before:rounded-2xl before:-z-10 p-6 border border-white/10 rounded-2xl backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-green-400 shadow-inner border border-white/5">
                 <CheckCircle2 size={24} />
              </div>
              <div>
                 <h4 className="font-bold text-white tracking-wide">Full Offline Capabilities</h4>
                 <p className="text-sm text-slate-400 mt-1">Work seamlessly without a connection.</p>
              </div>
            </div>
            
            <div className="w-full h-px bg-gradient-to-r from-white/10 to-transparent"></div>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-purple-400 shadow-inner border border-white/5">
                 <Building2 size={24} />
              </div>
              <div>
                 <h4 className="font-bold text-white tracking-wide">Enterprise Ready</h4>
                 <p className="text-sm text-slate-400 mt-1">Built to scale with your growing operations.</p>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
