import React from 'react';
import { formatMoney, formatDate } from '../utils/formatters';
import type { Quote, Invoice } from '../types';
import { Badge } from './ui';
import { useAppStore } from '../store/useAppStore';

interface SidePanelDetailsProps {
  document: Quote | Invoice;
  type: 'QUOTE' | 'INVOICE';
}

export const SidePanelDetails: React.FC<SidePanelDetailsProps> = ({ document, type }) => {
  const { businessProfile } = useAppStore();
  const currency = document.currency || businessProfile?.currency || 'NGN';
  const isInvoice = type === 'INVOICE';
  const docNumber = isInvoice ? (document as Invoice).invoiceNumber : (document as Quote).quoteNumber;
  
  // Need to compute taxes sum if taxTotal doesn't exist directly
  const taxTotal = document.taxes?.reduce((sum, t) => sum + (t.isDeduction ? -t.amount : t.amount), 0) || 0;
  
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-y-auto custom-scrollbar">
      {/* Header section */}
      <div className="p-6 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
              {type === 'QUOTE' ? 'Quote' : 'Invoice'} {docNumber ? `#${docNumber}` : ''}
            </h3>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {formatMoney(document.total, currency)}
            </div>
          </div>
          <Badge variant={document.status.toLowerCase() as any}>{document.status}</Badge>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-slate-500 dark:text-slate-400">Date</div>
            <div className="font-medium text-slate-900 dark:text-white">{formatDate(document.createdAt)}</div>
          </div>
          {isInvoice && (document as Invoice).dueDate && (
            <div>
              <div className="text-slate-500 dark:text-slate-400">Due Date</div>
              <div className="font-medium text-slate-900 dark:text-white">{formatDate((document as Invoice).dueDate!)}</div>
            </div>
          )}
          {type === 'QUOTE' && (document as Quote).expiresAt && (
            <div>
              <div className="text-slate-500 dark:text-slate-400">Valid Until</div>
              <div className="font-medium text-slate-900 dark:text-white">{formatDate((document as Quote).expiresAt!)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Line Items section */}
      <div className="p-6 flex-1">
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Items</h4>
        <div className="space-y-3">
          {document.items?.map((item: any, idx: number) => {
            const unitPrice = item.unitPrice || item.rate || 0;
            const amount = item.amount || (unitPrice * item.quantity);
            const tax = item.tax || 0;
            return (
              <div key={item.id || idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div className="font-medium text-slate-900 dark:text-white line-clamp-2 pr-4">{item.description}</div>
                  <div className="font-semibold text-slate-900 dark:text-white shrink-0">
                    {formatMoney(amount, currency)}
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                  <div>{item.quantity} × {formatMoney(unitPrice, currency)}</div>
                  {tax > 0 && <div>+ Tax: {tax}%</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Totals Section */}
        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center text-sm mb-3 text-slate-600 dark:text-slate-400">
            <span>Subtotal</span>
            <span>{formatMoney(document.subtotal, currency)}</span>
          </div>
          <div className="flex justify-between items-center text-sm mb-4 text-slate-600 dark:text-slate-400">
            <span>Taxes</span>
            <span>{formatMoney(taxTotal, currency)}</span>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-slate-100 dark:border-slate-700 font-bold text-lg text-slate-900 dark:text-white">
            <span>Total</span>
            <span>{formatMoney(document.total, currency)}</span>
          </div>
          {isInvoice && (document as Invoice).amountPaid > 0 && (
            <div className="flex justify-between items-center text-sm mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-medium">
              <span>Amount Paid</span>
              <span>-{formatMoney((document as Invoice).amountPaid, currency)}</span>
            </div>
          )}
          {isInvoice && (document as Invoice).amountPaid > 0 && (
            <div className="flex justify-between items-center text-sm mt-2 font-bold text-slate-900 dark:text-white">
              <span>Balance Due</span>
              <span>{formatMoney(document.total - (document as Invoice).amountPaid, currency)}</span>
            </div>
          )}
        </div>
        
        {document.notes && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</h4>
            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl text-sm text-slate-700 dark:text-slate-300 border border-amber-100 dark:border-amber-900/30 whitespace-pre-wrap">
              {document.notes}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
