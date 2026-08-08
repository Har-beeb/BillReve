import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Logo } from './ui/Logo';
import { useAppStore } from '../store/useAppStore';

export const PublicHeader: React.FC = () => {
  const navigate = useNavigate();
  const isAuthenticated = useAppStore(state => state.isAuthenticated);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <nav className="fixed w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
            <Logo size="md" className="flex-shrink-0" />
            <span className="font-['Outfit'] font-black text-2xl tracking-tight text-purple-600 dark:text-purple-400">
              BillReve
            </span>
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            <Link to="/#features" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Features</Link>
            <Link to="/#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Pricing</Link>
            
            <div className="flex items-center space-x-4 pl-4 border-l border-slate-200 dark:border-slate-700">
              <Link to="/login" className="text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                Log in
              </Link>
              <button 
                onClick={handleGetStarted}
                className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold transition-all shadow-lg hover:shadow-purple-500/25 active:scale-95"
              >
                Get Started
              </button>
            </div>
          </div>

          <div className="md:hidden flex items-center">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-slate-600 dark:text-slate-300 focus:outline-none"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 flex flex-col space-y-4">
              <Link to="/#features" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md">Features</Link>
              <Link to="/#pricing" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-md">Pricing</Link>
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2 flex flex-col gap-3">
                <button 
                  onClick={() => { setIsMobileMenuOpen(false); navigate('/login'); }}
                  className="w-full text-center px-4 py-3 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl"
                >
                  Log in
                </button>
                <button 
                  onClick={() => { setIsMobileMenuOpen(false); handleGetStarted(); }}
                  className="w-full text-center px-4 py-3 font-bold text-white bg-purple-600 rounded-xl shadow-lg shadow-purple-500/25"
                >
                  Get Started
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
