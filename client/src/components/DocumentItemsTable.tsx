import React, { useState } from 'react';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { enhanceAiText } from '../api/ai';

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface DocumentItemsTableProps {
  items: LineItem[];
  onItemChange: (id: string, field: keyof LineItem, value: string | number) => void;
  onRemoveItem: (id: string) => void;
  onAddItem: () => void;
}

export const DocumentItemsTable: React.FC<DocumentItemsTableProps> = ({
  items,
  onItemChange,
  onRemoveItem,
  onAddItem,
}) => {
  const [enhancingId, setEnhancingId] = useState<string | null>(null);

  const handleEnhance = async (id: string, text: string) => {
    if (!text.trim()) return;
    try {
      setEnhancingId(id);
      const enhanced = await enhanceAiText({ text, mode: 'line_item' });
      if (enhanced?.text) {
        onItemChange(id, 'description', enhanced.text);
      }
    } catch (err) {
      console.error(err);
      // Fallback silently or show toast if we had one
    } finally {
      setEnhancingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Line Items</h2>
      
      <div className="space-y-4">
        {/* Desktop Header row */}
        <div className="hidden md:grid grid-cols-12 gap-4 pb-2 border-b border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-500">
          <div className="col-span-5">Description</div>
          <div className="col-span-2 text-right">Qty</div>
          <div className="col-span-2 text-right">Rate</div>
          <div className="col-span-3 text-right">Amount</div>
        </div>

        {items.map((item) => (
          <div key={item.id} className="relative flex flex-col md:grid md:grid-cols-12 gap-4 md:items-center p-4 md:p-2 md:-mx-2 bg-slate-50 hover:bg-slate-100 md:bg-transparent dark:bg-slate-800/50 md:dark:bg-transparent rounded-xl md:rounded-none group transition-colors">
            <div className="md:col-span-5 relative">
              <label className="md:hidden text-xs font-medium text-slate-500 mb-1.5 block">Description</label>
              <div className="relative group/input">
                <input 
                  type="text" 
                  value={item.description}
                  onChange={(e) => onItemChange(item.id, 'description', e.target.value)}
                  placeholder="Item description"
                  className="w-full p-3.5 md:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white md:bg-slate-50 md:hover:bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium text-sm shadow-sm md:shadow-none"
                />
                <button
                  onClick={() => handleEnhance(item.id, item.description)}
                  disabled={enhancingId === item.id || !item.description.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-md transition-all opacity-0 group-hover/input:opacity-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  title="Enhance Description with AI"
                >
                  {enhancingId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 md:contents">
              <div className="md:col-span-2">
                <label className="md:hidden text-xs font-medium text-slate-500 mb-1.5 block">Quantity</label>
                <input 
                  type="number" 
                  min="1"
                  value={item.quantity}
                  onChange={(e) => onItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                  className="w-full p-3.5 md:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white md:bg-slate-50 md:hover:bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-right font-medium text-sm shadow-sm md:shadow-none"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="md:hidden text-xs font-medium text-slate-500 mb-1.5 block">Rate</label>
                <input 
                  type="number" 
                  min="0"
                  value={item.unitPrice}
                  onChange={(e) => onItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full p-3.5 md:p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white md:bg-slate-50 md:hover:bg-white dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-right font-medium text-sm shadow-sm md:shadow-none"
                />
              </div>
              
              <div className="col-span-2 md:col-span-3 flex justify-between md:justify-end items-center mt-2 md:mt-0 pt-3 md:pt-0 border-t border-slate-200 dark:border-slate-700 md:border-none">
                 <label className="md:hidden text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Amount</label>
                 <div className="text-right font-bold text-slate-900 dark:text-white text-base md:text-sm truncate">
                   {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                 </div>
              </div>
            </div>

            {/* Remove Button */}
            <button 
              onClick={() => onRemoveItem(item.id)}
              className="absolute -right-2 -top-2 md:static md:absolute md:right-auto md:-left-8 text-slate-400 hover:text-red-500 transition-colors md:opacity-0 md:group-hover:opacity-100 bg-white md:bg-transparent shadow-md md:shadow-none rounded-full p-1.5 md:p-0 z-10 border border-slate-100 md:border-none dark:bg-slate-800 dark:border-slate-700 md:dark:bg-transparent"
              disabled={items.length === 1}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </button>
          </div>
        ))}
      </div>

      <button 
        onClick={onAddItem}
        className="mt-6 flex items-center gap-2 text-purple-600 dark:text-purple-400 font-medium hover:text-purple-700 transition-colors"
      >
        <Plus size={18} /> Add Item
      </button>
    </div>
  );
};
