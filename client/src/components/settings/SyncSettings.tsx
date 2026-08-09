import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useFeatureFlags } from '../../hooks/useFeatureFlags';
import { syncEngine } from '../../services/syncEngine';
import { Cloud, RefreshCw, Trash2, Database, FileUp, Loader2 } from 'lucide-react';
import { CsvImportWizard } from '../CsvImportWizard';
import toast from 'react-hot-toast';

export const SyncSettings: React.FC = () => {
  const { user, syncStatus } = useAppStore();
  const { enableCsvImport, enableMockData } = useFeatureFlags();
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isGeneratingData, setIsGeneratingData] = useState(false);
  const [isClearingData, setIsClearingData] = useState(false);

  return (
    <>
      <div className="space-y-6 max-w-2xl mx-auto py-2">
        <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mb-4">
            <Cloud size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Cloud Sync</h3>
          <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto mb-6 text-sm">
            BillReve works offline-first. Your data is saved locally on this device and automatically syncs to the cloud when you are online.
          </p>

          <div className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Current Status</div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mt-1">
                {syncStatus === 'synced' && <span className="text-green-600 dark:text-green-400">● All data synced</span>}
                {syncStatus === 'syncing' && <span className="text-purple-600 dark:text-purple-400">● Syncing to cloud...</span>}
                {syncStatus === 'pending' && <span className="text-amber-600 dark:text-amber-400">● Offline - Changes pending</span>}
                {syncStatus === 'failed' && <span className="text-red-600 dark:text-red-400">● Sync failed</span>}
              </div>
            </div>
            <button 
              onClick={() => syncEngine.sync()}
              disabled={syncStatus === 'syncing'}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
            >
              <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
              Force Sync
            </button>
          </div>
          
          {/* Developer Tools for Mocking Data */}
          {enableMockData && (
            <div className="w-full bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4 mt-2 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-left">
              <div>
                <div className="text-sm font-medium text-purple-700 dark:text-purple-400">Developer Tools</div>
                <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1">
                  Instantly populate your account with 15 clients, 25 invoices, and 10 quotes for testing.
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                <button 
                  onClick={() => setShowClearConfirm(true)}
                  disabled={isClearingData || isGeneratingData}
                  className="flex items-center justify-center gap-2 bg-white dark:bg-slate-800 text-red-600 border border-red-200 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto disabled:opacity-50"
                >
                  {isClearingData ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                  {isClearingData ? 'Clearing...' : 'Clear Data'}
                </button>
                <button 
                  onClick={async () => {
                    if (!user) return;
                    setIsGeneratingData(true);
                    try {
                      const { generateMockData } = await import('../../utils/mockDataGenerator');
                      await generateMockData(user.id);
                      toast.success('Successfully generated mock data!');
                      window.location.reload();
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to generate mock data.');
                    } finally {
                      setIsGeneratingData(false);
                    }
                  }}
                  disabled={isClearingData || isGeneratingData}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto disabled:opacity-50"
                >
                  {isGeneratingData ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                  {isGeneratingData ? 'Generating...' : 'Generate Mock Data'}
                </button>
              </div>
            </div>
          )}

          {/* Data Migration */}
          {enableCsvImport && (
            <div className="w-full bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/50 rounded-lg p-4 mt-6 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 text-left">
              <div>
                <div className="text-sm font-medium text-purple-700 dark:text-purple-400">Data Migration</div>
                <div className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-1 max-w-lg">
                  Import your clients, invoices, or quotes from QuickBooks, Wave, or any other system using our CSV Import Wizard.
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full xl:w-auto">
                <button 
                  onClick={() => setShowImportWizard(true)}
                  className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm whitespace-nowrap w-full sm:w-auto shadow-sm"
                >
                  <FileUp size={16} />
                  Import CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {showImportWizard && (
        <CsvImportWizard onClose={() => setShowImportWizard(false)} />
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 animate-slide-up">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Clear All Data</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Are you sure you want to permanently delete ALL clients, invoices, and quotes from both your device and the cloud? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearingData}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user) return;
                  setIsClearingData(true);
                  try {
                    const { clearAllData } = await import('../../utils/mockDataGenerator');
                    await clearAllData(user.id);
                    toast.success('Successfully cleared all data.');
                    window.location.reload();
                  } catch (err: any) {
                    toast.error(err.message || 'Error clearing data.');
                  } finally {
                    setIsClearingData(false);
                    setShowClearConfirm(false);
                  }
                }}
                disabled={isClearingData}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isClearingData && <Loader2 size={16} className="animate-spin" />}
                {isClearingData ? 'Deleting...' : 'Yes, Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
