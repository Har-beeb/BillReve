import React, { useState, useEffect } from 'react';
import { Badge } from '../ui';
import { Building2, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

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
    }, 2500); // Change word every 2.5 seconds

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

      <div className="hidden lg:flex w-1/2 relative overflow-hidden items-center justify-center bg-slate-50">
        
        {/* Animated Background Gradients inspired by /upgrade */}
        <motion.div 
          animate={{ rotate: 360, scale: [1, 1.1, 1] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 left-1/4 w-[40rem] h-[40rem] bg-purple-600/10 rounded-full blur-3xl pointer-events-none" 
        />
        <motion.div 
          animate={{ rotate: -360, scale: [1, 1.2, 1] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 right-1/4 w-[35rem] h-[35rem] bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" 
        />
        
        {/* Decorative central rotated gradient blob */}
        <motion.div 
          animate={{ rotate: [0, 5, 0, -5, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0 m-auto w-3/4 h-3/4 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-[3rem] opacity-5 blur-sm mix-blend-multiply pointer-events-none" 
        />

        {/* Content Box */}
        <div className="relative z-10 w-full max-w-xl px-8 lg:px-12 animate-fade-in-up" style={{ animationDelay: '150ms' }}>
          
          <div className="bg-white/60 backdrop-blur-2xl rounded-[2rem] shadow-2xl border border-white/50 p-10 transform transition-all">
            <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-6">Offline-First Invoicing</Badge>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 leading-tight tracking-tight min-h-[120px] md:min-h-[144px] text-slate-900">
               Manage your <br />
               business{' '}
               <span key={WORDS[wordIndex]} className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 inline-block animate-fade-in-up">
                  {WORDS[wordIndex]}
               </span>
            </h2>
            
            <p className="text-slate-600 text-lg mb-8 leading-relaxed font-light">
               BillReve is the premier offline-first invoicing platform designed for modern SMEs and enterprises. Create quotes, manage clients, and track payments without worrying about internet connectivity.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-white/80 p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                   <CheckCircle2 size={20} />
                </div>
                <div>
                   <h4 className="font-bold text-slate-900 text-sm">Full Offline Capabilities</h4>
                   <p className="text-xs text-slate-500 mt-0.5">Work seamlessly without a connection.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-white/80 p-4 rounded-xl border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                   <Building2 size={20} />
                </div>
                <div>
                   <h4 className="font-bold text-slate-900 text-sm">Enterprise Ready</h4>
                   <p className="text-xs text-slate-500 mt-0.5">Built to scale with your growing operations.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
