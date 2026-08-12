import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const UpdatePrompt: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Periodic check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] animate-fade-in-up">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 max-w-sm w-full flex items-start gap-4">
        <div className="bg-purple-100 dark:bg-purple-900/50 p-2 rounded-lg text-purple-600 dark:text-purple-400 shrink-0">
          <RefreshCw size={20} className="animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="text-slate-900 dark:text-white font-bold text-sm mb-1">Update Available</h3>
          <p className="text-slate-500 dark:text-slate-400 text-xs mb-3">
            A new version of BillReve is available. Update now to get the latest features and bug fixes.
          </p>
          <div className="flex gap-2">
            <button 
              onClick={() => updateServiceWorker(true)}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-md transition-colors"
            >
              Update Now
            </button>
            <button 
              onClick={close}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-md transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button onClick={close} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
