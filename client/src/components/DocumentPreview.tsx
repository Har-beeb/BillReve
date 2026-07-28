import React from 'react';
import { Eye } from 'lucide-react';
import DOMPurify from 'dompurify';

interface DocumentPreviewProps {
  businessProfile: any;
  type: 'QUOTE' | 'INVOICE';
  documentNumber: string;
  initialDoc: any;
  clientId: string;
  clients: any[];
  isCreatingClient: boolean;
  newClientName: string;
  newClientEmail: string;
  dueDate: string;
  items: any[];
  subtotal: number;
  computedTaxes: any[];
  total: number;
  description: string;
  notes?: string;
  bankAccountId: string;
}

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  businessProfile,
  type,
  documentNumber,
  initialDoc,
  clientId,
  clients,
  isCreatingClient,
  newClientName,
  newClientEmail,
  dueDate,
  items,
  subtotal,
  computedTaxes,
  total,
  description,
  notes,
  bankAccountId,
}) => {
  const sanitizedNotes = notes ? DOMPurify.sanitize(notes, { ALLOWED_TAGS: ['br', 'b', 'i', 'strong', 'em', 'p'] }) : '';

  return (
    <div className="hidden md:flex flex-1 bg-slate-200/50 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-700 p-6 flex-col overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-2 text-slate-500 mb-4 uppercase tracking-wider text-sm font-semibold shrink-0">
        <Eye size={16} /> Live Preview
      </div>
      
      {/* Document Mock */}
      <div className="bg-white text-slate-900 p-8 shadow-2xl rounded-sm min-h-[842px] w-full max-w-[850px] mx-auto flex flex-col relative transition-all duration-300 shrink-0">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-12">
          <div>
            {businessProfile?.logoUrl ? (
              <div className="w-24 h-24 mb-6">
                 <img src={businessProfile.logoUrl} alt="Logo" className="w-full h-full object-contain object-left" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-xl bg-purple-600 flex items-center justify-center mb-6">
                 <div className="w-8 h-8 bg-white rounded-md transform rotate-45" />
              </div>
            )}
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight uppercase">{type === 'QUOTE' ? 'QUOTE' : 'INVOICE'}</h1>
            <p className="text-slate-500 mt-2 font-medium">#{type === 'QUOTE' ? (initialDoc?.quoteNumber || documentNumber) : (initialDoc?.invoiceNumber || documentNumber)}</p>
          </div>
          <div className="text-right text-slate-600">
            <p className="font-bold text-slate-900 text-lg mb-1">{businessProfile?.name || 'Business Name'}</p>
            <p className="whitespace-pre-line text-sm">{businessProfile?.address}</p>
          </div>
        </div>

        {/* Bill To & Dates Grid */}
        <div className="grid grid-cols-2 gap-12 mb-8 border-y border-slate-100 py-6">
           <div>
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</p>
             {isCreatingClient ? (
               <div>
                 <p className="font-bold text-slate-900 text-base">{newClientName || 'Client Name'}</p>
                 <p className="text-slate-500 text-sm mt-1">{newClientEmail}</p>
               </div>
             ) : (
               <div>
                 <p className="font-bold text-slate-900 text-base">
                   {clientId ? clients.find(c => c.localId === clientId)?.name : 'Select a Client'}
                 </p>
                 <p className="text-slate-500 text-sm mt-1">
                   {clientId ? clients.find(c => c.localId === clientId)?.email : ''}
                 </p>
               </div>
             )}
           </div>
           <div className="text-right flex flex-col items-end gap-4">
             <div>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
               <p className="font-medium text-slate-900 text-sm">{new Date().toLocaleDateString()}</p>
             </div>
             {type === 'INVOICE' && dueDate && (
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</p>
                 <p className="font-medium text-slate-900 text-sm">{new Date(dueDate).toLocaleDateString()}</p>
               </div>
             )}
           </div>
        </div>

        {description && (
          <div className="mb-8">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Project Description</p>
             <p className="text-slate-700 text-sm">{description}</p>
          </div>
        )}

        {/* Line Items Table */}
        <div className="flex-1">
          <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty</th>
                  <th className="px-4 py-3 font-semibold text-right">Rate</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.filter(i => i.description).length > 0 ? (
                  items.filter(i => i.description).map((i, idx) => (
                    <tr key={idx} className="bg-white">
                      <td className="px-4 py-3 text-slate-900 font-medium">{i.description}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{i.quantity}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{i.unitPrice.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-slate-900 font-bold">{i.amount.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-400 italic">No items added yet</td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div className="bg-white p-4 flex justify-end border-t border-slate-200">
              <div className="w-full sm:w-2/3 md:w-1/2 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {computedTaxes.map((t, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600">
                    <span>{t.name}</span>
                    <span>{t.isDeduction ? '-' : ''}{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-3 border-t border-slate-200 mt-2">
                  <span>Total</span>
                  <span className="text-purple-600">NGN {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info (Notes & Bank) */}
        <div className="mt-8 space-y-6">
          {notes && (
            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Terms & Notes</p>
              <p className="text-slate-600 text-xs whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: sanitizedNotes }}></p>
            </div>
          )}

          {bankAccountId && businessProfile.bankAccounts?.find((b: any) => b.id === bankAccountId) && (
            <div className="pt-6 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Payment Details</p>
              {(() => {
                const bank = businessProfile.bankAccounts.find((b: any) => b.id === bankAccountId);
                return (
                  <div className="text-xs space-y-1">
                    <p className="text-slate-600"><span className="font-medium text-slate-900">Bank:</span> {bank?.bankName}</p>
                    <p className="text-slate-600"><span className="font-medium text-slate-900">Account Name:</span> {bank?.accountName}</p>
                    <p className="text-slate-600"><span className="font-medium text-slate-900">Account Number:</span> {bank?.accountNumber}</p>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        <div className="mt-8 pt-8 text-center text-[10px] text-slate-400 w-full border-t border-slate-100">
          Powered by <span className="font-semibold text-slate-500">{businessProfile.name || 'BillReve'}</span>
        </div>
      </div>
    </div>
  );
};
