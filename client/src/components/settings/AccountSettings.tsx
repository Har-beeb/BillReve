import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';

export const AccountSettings: React.FC = () => {
  const { user, isProUser } = useAppStore();
  const navigate = useNavigate();

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-2">
      <div className="flex items-start gap-6">
        <div className="w-24 h-24 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 overflow-hidden text-3xl font-bold">
          {(() => {
            const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
            const fullName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
            const initial = fullName.charAt(0).toUpperCase();
            if (avatarUrl) {
              return <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />;
            }
            return <span>{initial}</span>;
          })()}
        </div>
        <div className="flex-1 space-y-2 pt-2">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
            {user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
          </h3>
          <p className="text-sm text-slate-500">{user?.email}</p>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 mt-2">
            {user?.app_metadata?.provider === 'google' ? 'Google Account' : 'Email Account'}
          </div>
        </div>
      </div>
      {!isProUser && (
        <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col gap-4">
          <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white flex flex-col sm:flex-row justify-between items-center gap-4 shadow-lg">
            <div>
              <h4 className="text-xl font-bold mb-1">Upgrade to BillReve Pro 🚀</h4>
              <p className="text-purple-200 text-sm">Accept global payments, remove branding, and automate reminders.</p>
            </div>
            <button onClick={() => navigate('/upgrade')} className="bg-white text-purple-900 hover:bg-slate-100 font-bold py-2.5 px-6 rounded-lg transition-colors whitespace-nowrap">View Pro Plan</button>
          </div>
        </div>
      )}
      <div className="pt-6 mt-6 border-t border-slate-200 dark:border-slate-700">
        <p className="text-sm text-slate-500">
          Your personal account details are managed by your authentication provider. 
          To update your name or profile picture, please update your Google account.
        </p>
      </div>
    </div>
  );
};
