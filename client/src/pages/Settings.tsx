import React, { useState } from 'react';
import { Building2, Receipt, User, Database, Settings as SettingsIcon } from 'lucide-react';
import { AccountSettings } from '../components/settings/AccountSettings';
import { PreferencesSettings } from '../components/settings/PreferencesSettings';
import { ProfileSettings } from '../components/settings/ProfileSettings';
import { TaxSettings } from '../components/settings/TaxSettings';
import { SyncSettings } from '../components/settings/SyncSettings';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'taxes' | 'sync' | 'preferences'>('account');

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto hide-scrollbar">
          <button
            onClick={() => setActiveTab('account')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'account' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <User size={18} />
            User Account
          </button>
          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'preferences' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <SettingsIcon size={18} />
            Preferences
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'profile' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Building2 size={18} />
            Business Profile
          </button>
          <button
            onClick={() => setActiveTab('taxes')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'taxes' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Receipt size={18} />
            Tax Settings
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'sync' 
                ? 'border-b-2 border-purple-600 text-purple-600 dark:text-purple-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
            }`}
          >
            <Database size={18} />
            Data & Sync
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'account' && <AccountSettings />}
          {activeTab === 'preferences' && <PreferencesSettings />}
          {activeTab === 'profile' && <ProfileSettings />}
          {activeTab === 'taxes' && <TaxSettings />}
          {activeTab === 'sync' && <SyncSettings />}
        </div>
      </div>
    </div>
  );
};

export default Settings;




