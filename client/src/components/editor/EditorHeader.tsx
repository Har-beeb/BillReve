import React from 'react';
import { ChevronDown } from 'lucide-react';

interface EditorHeaderProps {
  type: 'QUOTE' | 'INVOICE';
  clients: any[];
  clientId: string;
  setClientId: (id: string) => void;
  isCreatingClient: boolean;
  setIsCreatingClient: (is: boolean) => void;
  newClientName: string;
  setNewClientName: (name: string) => void;
  newClientEmail: string;
  setNewClientEmail: (email: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  dueDate: string;
  setDueDate: (date: string) => void;
  bankAccountId: string;
  setBankAccountId: (id: string) => void;
  businessProfile: any;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  type,
  clients,
  clientId,
  setClientId,
  isCreatingClient,
  setIsCreatingClient,
  newClientName,
  setNewClientName,
  newClientEmail,
  setNewClientEmail,
  description,
  setDescription,
  dueDate,
  setDueDate,
  bankAccountId,
  setBankAccountId,
  businessProfile,
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Client Details</h2>
        
        {!isCreatingClient ? (
          <div className="relative group">
            <select 
              className="appearance-none w-full p-3.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white cursor-pointer outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all group-hover:border-slate-300 dark:group-hover:border-slate-700 font-medium"
              value={clientId}
              onChange={(e) => {
                if (e.target.value === 'NEW') setIsCreatingClient(true);
                else setClientId(e.target.value);
              }}
            >
              <option value="" className="text-slate-400">Select a client...</option>
              {clients.map(c => (
                <option key={c.localId} value={c.localId} className="bg-white dark:bg-slate-800">{c.name}</option>
              ))}
              <option value="NEW" className="bg-white dark:bg-slate-800 font-semibold text-purple-600 dark:text-purple-400">+ Create New Client</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform group-hover:text-slate-600 dark:group-hover:text-slate-300" size={18} />
          </div>
        ) : (
          <div className="space-y-4 border border-purple-200 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 p-5 rounded-xl">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-purple-600 dark:text-purple-400">New Client</h3>
              <button onClick={() => setIsCreatingClient(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium">
                Cancel
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Company / Name</label>
                <input 
                  type="text" 
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
                <input 
                  type="email" 
                  value={newClientEmail}
                  onChange={(e) => setNewClientEmail(e.target.value)}
                  className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
                  placeholder="billing@acme.com"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="border-slate-100 dark:border-slate-800/50" />

      <div>
        <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Document Details</h2>
        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Project / Description</label>
        <input 
          type="text"
          value={description || ''}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={`e.g. Website Redesign ${new Date().getFullYear()}`}
          className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium"
        />
      </div>

      <hr className="border-slate-100 dark:border-slate-800/50" />

      <div className="space-y-6">
        <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dates & Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{type === 'QUOTE' ? 'Expiry Date' : 'Due Date'}</label>
              <input 
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>

          {(type === 'INVOICE' || (businessProfile.bankAccounts && businessProfile.bankAccounts.length > 0)) && (
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Receiving Bank</label>
              <div className="relative group">
                <select 
                  className="appearance-none w-full p-3.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white cursor-pointer outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all group-hover:border-slate-300 dark:group-hover:border-slate-700"
                  value={bankAccountId}
                  onChange={(e) => setBankAccountId(e.target.value)}
                >
                  <option value="">Do not include bank details</option>
                  {businessProfile.bankAccounts?.map((b: any) => (
                    <option key={b.id} value={b.id} className="bg-white dark:bg-slate-800">
                      {b.bankName} - {b.accountNumber}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform group-hover:text-slate-600 dark:group-hover:text-slate-300" size={18} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
