import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Invoice } from '../types';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/useAppStore';
import { formatMoney, getCurrencySymbol } from '../utils/formatters';

interface RecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onConfirm: (amount: number) => Promise<void>;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onConfirm
}) => {
  const [amount, setAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const businessProfile = useAppStore((state) => state.businessProfile);

  if (!isOpen || !invoice) return null;

  const activeCurrency = businessProfile?.currency || invoice.currency || 'NGN';
  const balanceDue = invoice.total - invoice.amountPaid;

  const handleConfirm = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }
    if (numAmount > balanceDue) {
      toast.error("Amount cannot exceed the balance due.");
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm(numAmount);
      setAmount('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm relative z-10 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Record Payment</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Invoice #{invoice.invoiceNumber || invoice.localId.slice(0, 8)}</p>
          <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Balance Due</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatMoney(balanceDue, activeCurrency)}</span>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Payment Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base font-medium">{getCurrencySymbol(activeCurrency)}</span>
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={balanceDue.toString()}
              max={balanceDue}
              className="w-full pl-14 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent focus:ring-2 focus:ring-purple-500 outline-none dark:text-white"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isSubmitting || !amount}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
