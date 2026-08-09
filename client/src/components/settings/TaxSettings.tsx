import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { Trash2, Plus, Save } from 'lucide-react';
import type { TaxSetting } from '../../types';

export const TaxSettings: React.FC = () => {
  const { taxSettings, updateTaxSettings } = useAppStore();
  const [localTaxes, setLocalTaxes] = useState<TaxSetting[]>(taxSettings);

  useEffect(() => {
    setLocalTaxes(taxSettings);
  }, [taxSettings]);

  const handleSaveTaxes = () => {
    updateTaxSettings(localTaxes);
    toast.success('Tax settings saved successfully!');
  };

  const addTaxRule = () => {
    setLocalTaxes([...localTaxes, { id: uuidv4(), name: 'New Tax', rate: 0, isDeduction: false, isActive: true }]);
  };

  const removeTaxRule = (id: string) => {
    setLocalTaxes(localTaxes.filter(t => t.id !== id));
  };

  const updateTaxRule = (id: string, field: keyof TaxSetting, value: string | number | boolean) => {
    setLocalTaxes(localTaxes.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-2">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Define the default tax rules available when creating Quotes and Invoices.
        </p>
        
        {localTaxes.map((tax) => (
          <div key={tax.id} className="flex gap-4 items-start p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg">
            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Tax Name</label>
                <input 
                  type="text" 
                  value={tax.name}
                  onChange={(e) => updateTaxRule(tax.id, 'name', e.target.value)}
                  placeholder="e.g. VAT"
                  className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Rate (%)</label>
                <input 
                  type="number" 
                  step="0.1"
                  value={tax.rate}
                  onChange={(e) => updateTaxRule(tax.id, 'rate', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
              </div>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer mt-6 text-sm text-slate-600 dark:text-slate-400">
                <input 
                  type="checkbox" 
                  checked={tax.isDeduction}
                  onChange={(e) => updateTaxRule(tax.id, 'isDeduction', e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                Is Deduction?
              </label>
              <button 
                onClick={() => removeTaxRule(tax.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Remove Tax"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}

        <button 
          onClick={addTaxRule}
          className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 transition-colors text-sm"
        >
          <Plus size={16} /> Add Tax Rule
        </button>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
        <button 
          onClick={handleSaveTaxes}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          <Save size={18} />
          Save Taxes
        </button>
      </div>
    </div>
  );
};
