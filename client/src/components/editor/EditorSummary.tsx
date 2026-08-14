import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface EditorSummaryProps {
  type: 'QUOTE' | 'INVOICE';
  currency: string;
  notes: string;
  setNotes: (notes: string) => void;
  aiEnabled: boolean;
  isProUser: boolean;
  handleEnhanceNote: () => void;
  isEnhancingNote: boolean;
  taxSettings: any[];
  appliedTaxes: Set<string>;
  setAppliedTaxes: (taxes: Set<string>) => void;
  subtotal: number;
  computedTaxes: any[];
  total: number;
  allowCounterOffer: boolean;
  setAllowCounterOffer: (allow: boolean) => void;
  minimumCounterAmount: number | undefined;
  setMinimumCounterAmount: (amount: number | undefined) => void;
}

export const EditorSummary: React.FC<EditorSummaryProps> = ({
  type,
  currency,
  notes,
  setNotes,
  aiEnabled,
  isProUser,
  handleEnhanceNote,
  isEnhancingNote,
  taxSettings,
  appliedTaxes,
  setAppliedTaxes,
  subtotal,
  computedTaxes,
  total,
  allowCounterOffer,
  setAllowCounterOffer,
  minimumCounterAmount,
  setMinimumCounterAmount,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Terms & Notes</label>
          {aiEnabled && isProUser && (
            <button
              onClick={handleEnhanceNote}
              disabled={isEnhancingNote || !(notes || '').trim()}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              title="Enhance Terms with AI"
            >
              {isEnhancingNote ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>AI Expand</span>
            </button>
          )}
        </div>
        <textarea 
          rows={3}
          value={notes || ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Terms, conditions, and notes for the client..."
          className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm leading-relaxed"
        />
      </div>

      <hr className="border-slate-100 dark:border-slate-800/50" />

      <div className="space-y-6">
        <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Taxes & Totals</h2>
        
        <div className="flex flex-col gap-8">
          <div className="space-y-3">
            {taxSettings.map(tax => (
              <label key={tax.id} className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    checked={appliedTaxes.has(tax.id)} 
                    onChange={(e) => {
                      const newSet = new Set(appliedTaxes);
                      if (e.target.checked) newSet.add(tax.id);
                      else newSet.delete(tax.id);
                      setAppliedTaxes(newSet);
                    }}
                    className="w-5 h-5 rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:bg-purple-600 checked:border-transparent"
                  />
                  {appliedTaxes.has(tax.id) && (
                    <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none" viewBox="0 0 14 14" fill="none">
                      <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="font-medium text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Apply {tax.name}</span>
              </label>
            ))}
          </div>
          
          <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 p-5 rounded-xl space-y-3">
             <div className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
               <span>Subtotal</span>
               <span className="font-medium text-slate-700 dark:text-slate-300">{currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             {computedTaxes.map((t, idx) => (
               <div key={idx} className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
                 <span>{t.name}</span>
                 <span className="font-medium text-slate-700 dark:text-slate-300">{t.isDeduction ? '- ' : '+ '}{currency} {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
               </div>
             ))}
             {computedTaxes.length > 0 && <hr className="border-slate-200 dark:border-slate-700" />}
             <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-lg">
               <span className="text-slate-900 dark:text-white">Total</span>
               <span className="text-purple-600 dark:text-purple-400">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
          </div>
        </div>
      </div>

      {type === 'QUOTE' && (
        <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Document Settings</h2>
          
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative inline-block w-10 h-6">
              <input 
                type="checkbox"
                checked={allowCounterOffer}
                onChange={(e) => setAllowCounterOffer(e.target.checked)}
                className="peer appearance-none w-10 h-6 bg-slate-200 dark:bg-slate-700 rounded-full checked:bg-purple-600 dark:checked:bg-purple-500 cursor-pointer transition-colors"
              />
              <span className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm pointer-events-none"></span>
            </div>
            <span className="font-medium text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
              Allow client to make a counter offer
            </span>
          </label>
          
          {allowCounterOffer && (
            <div className="mt-2 pl-[3.25rem]">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Minimum acceptable offer (Optional)
              </label>
              <div className="relative w-full sm:w-1/2">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                  {currency}
                </span>
                <input
                  type="number"
                  value={minimumCounterAmount || ''}
                  onChange={(e) => setMinimumCounterAmount(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full pl-12 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 transition-shadow"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
