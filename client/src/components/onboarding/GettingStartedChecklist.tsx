import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Circle, Trophy, Building2, Users, Receipt, Sparkles, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export const GettingStartedChecklist: React.FC = () => {
  const { businessProfile } = useAppStore();
  const navigate = useNavigate();

  // Use live Dexie queries for accurate real-time counts. Remove default value so we can detect loading state.
  const clientCount = useLiveQuery(() => db.clients.filter(c => !c.deletedAt).count());
  const invoiceCount = useLiveQuery(() => db.invoices.filter(i => !i.deletedAt).count());
  
  const [aiUsed, setAiUsed] = useState(localStorage.getItem('billreve_ai_used') === 'true');

  useEffect(() => {
    const handleStorage = () => {
      setAiUsed(localStorage.getItem('billreve_ai_used') === 'true');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Profile is complete only when name, industry AND businessDescription are all set
  const isProfileComplete = !!businessProfile.name && !!businessProfile.industry && !!businessProfile.businessDescription;

  const tasks = [
    {
      id: 'profile',
      title: 'Complete Business Profile',
      description: 'Add your industry, description and logo',
      icon: <Building2 className="w-5 h-5" />,
      isComplete: isProfileComplete,
      action: () => navigate('/settings'),
    },
    {
      id: 'client',
      title: 'Add your first Client',
      description: 'Create a client to bill',
      icon: <Users className="w-5 h-5" />,
      isComplete: (clientCount ?? 0) > 0,
      action: () => navigate('/clients'),
    },
    {
      id: 'invoice',
      title: 'Create an Invoice',
      description: 'Get paid faster',
      icon: <Receipt className="w-5 h-5" />,
      isComplete: (invoiceCount ?? 0) > 0,
      action: () => navigate('/invoices'),
    },
    {
      id: 'ai',
      title: 'Try RevenueChat AI',
      description: 'Draft an email or analyze your finances',
      icon: <Sparkles className="w-5 h-5" />,
      isComplete: aiUsed,
      action: () => {
        document.dispatchEvent(new CustomEvent('open-revenue-chat'));
        localStorage.setItem('billreve_ai_used', 'true');
        setAiUsed(true);
      },
    },
  ];

  const completedCount = tasks.filter(t => t.isComplete).length;
  const progress = (completedCount / tasks.length) * 100;
  const isAllComplete = completedCount === tasks.length;
  
  const [isDismissed, setIsDismissed] = useState(localStorage.getItem('billreve_checklist_dismissed') === 'true');

  const isLoading = clientCount === undefined || invoiceCount === undefined;

  if (isLoading || isDismissed || isAllComplete) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="mb-8 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Getting Started Guide</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Complete these steps to get the most out of BillReve.</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setIsDismissed(true);
              localStorage.setItem('billreve_checklist_dismissed', 'true');
            }}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {completedCount} of {tasks.length} tasks completed
            </span>
            <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-purple-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-700/50">
          {tasks.map((task) => (
            <div 
              key={task.id}
              onClick={() => !task.isComplete && task.action()}
              className={`p-6 transition-colors ${
                task.isComplete 
                  ? 'bg-slate-50/50 dark:bg-slate-900/20 opacity-75' 
                  : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 group'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${
                  task.isComplete 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/30 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors'
                }`}>
                  {task.icon}
                </div>
                {task.isComplete ? (
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 group-hover:text-purple-300 dark:group-hover:text-purple-700 transition-colors" />
                )}
              </div>
              <h3 className={`font-semibold mb-1 ${task.isComplete ? 'text-slate-600 dark:text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                {task.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {task.description}
              </p>
            </div>
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
