import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import { Logo } from './ui/Logo';
import { useAppStore } from '../store/useAppStore';

export const Footer: React.FC = () => {
  const { theme, toggleTheme } = useAppStore();
  
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Logo size="sm" className="flex-shrink-0" />
              <span className="font-['Outfit'] font-black text-2xl text-slate-900 dark:text-white">BillReve</span>
              <button 
                onClick={toggleTheme}
                className="ml-4 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
              The modern, offline-first invoicing platform built for freelancers, SMEs, and growing businesses.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Product</h4>
            <ul className="space-y-3">
              <li><Link to="/#features" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Features</Link></li>
              <li><Link to="/#pricing" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Pricing</Link></li>
              <li><Link to="/changelog" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Changelog</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Resources</h4>
            <ul className="space-y-3">
              <li><Link to="/help" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Help Center</Link></li>
              <li><Link to="/guides" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Invoicing Guides</Link></li>
              <li><Link to="/templates" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Free Templates</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white mb-4">Company</h4>
            <ul className="space-y-3">
              <li><Link to="/about" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">About Us</Link></li>
              <li><Link to="/contact" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Contact</Link></li>
              <li><Link to="/privacy" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-slate-200 dark:border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-slate-400 text-sm">
            &copy; {new Date().getFullYear()} BillReve. All rights reserved.
          </p>
          <div className="flex gap-4">
             {/* Social placeholders if needed */}
          </div>
        </div>
      </div>
    </footer>
  );
};
