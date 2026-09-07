import React from 'react';
import { Eye } from 'lucide-react';
import DOMPurify from 'dompurify';
import { useAppStore } from '../store/useAppStore';
import { Logo } from './ui/Logo';

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
  currency: string;
  className?: string;
  theme?: 'standard' | 'professional' | 'modern' | 'classic' | 'monochrome';
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
  currency,
  className,
  theme = 'standard'
}) => {
  const { fontFamily, fontSize, isProUser } = useAppStore();
  const sanitizedNotes = notes ? DOMPurify.sanitize(notes, { ALLOWED_TAGS: ['br', 'b', 'i', 'strong', 'em', 'p'] }) : '';

  const typographyStyle = isProUser ? {
    fontFamily: fontFamily === 'Inter' ? undefined : fontFamily,
    fontSize: fontSize === 'small' ? '0.875rem' : fontSize === 'large' ? '1.125rem' : '1rem'
  } : {};

  // Theme-specific styles
  const t = {
    standard: {
      docWrapper: "p-8 shadow-2xl rounded-sm border-t-4 border-slate-800",
      header: "mb-12",
      title: "text-4xl font-bold text-slate-900 tracking-tight uppercase",
      detailsGrid: "border-y border-slate-100 py-6",
      tableWrapper: "bg-slate-50 rounded-xl overflow-hidden border border-slate-200",
      tableHead: "bg-slate-100 text-slate-600 border-b border-slate-200",
      totalRow: "text-purple-600",
      accentText: "text-slate-400"
    },
    professional: {
      docWrapper: "p-0 shadow-2xl rounded-sm",
      header: "bg-slate-800 text-white p-8 pb-12 mb-8",
      title: "text-3xl font-medium tracking-widest uppercase text-white",
      detailsGrid: "px-8 mb-8 border-b border-slate-200 pb-8",
      tableWrapper: "px-8",
      tableHead: "border-b-2 border-slate-800 text-slate-900 uppercase tracking-wider text-[10px]",
      totalRow: "text-slate-900 text-lg",
      accentText: "text-slate-500"
    },
    modern: {
      docWrapper: "p-8 shadow-2xl rounded-3xl bg-purple-50/10 border-2 border-purple-100 bg-[linear-gradient(45deg,transparent_25%,rgba(243,232,255,0.3)_25%,rgba(243,232,255,0.3)_50%,transparent_50%,transparent_75%,rgba(243,232,255,0.3)_75%,rgba(243,232,255,0.3)_100%)] bg-[length:20px_20px]",
      header: "mb-8",
      title: "text-5xl font-black text-purple-600 tracking-tighter uppercase",
      detailsGrid: "bg-purple-50/50 rounded-2xl p-6 mb-8",
      tableWrapper: "",
      tableHead: "bg-purple-100/50 text-purple-900 rounded-lg",
      totalRow: "text-purple-700 text-xl font-black",
      accentText: "text-purple-400"
    },
    classic: {
      docWrapper: "p-10 shadow-xl rounded-sm font-serif border-4 border-double border-slate-300",
      header: "mb-10 text-center border-b-2 border-slate-800 pb-8",
      title: "text-4xl font-serif text-slate-900 tracking-widest uppercase",
      detailsGrid: "py-4 mb-6",
      tableWrapper: "border-t border-b border-slate-300 py-4",
      tableHead: "border-b border-slate-300 text-slate-900 font-serif uppercase tracking-widest text-xs",
      totalRow: "text-slate-900 font-serif text-xl border-t-2 border-slate-800 pt-2",
      accentText: "text-slate-600 font-serif italic"
    },
    monochrome: {
      docWrapper: "p-8 shadow-none border-8 border-black rounded-none",
      header: "mb-10 border-b-4 border-black pb-6",
      title: "text-4xl font-black text-black tracking-tight uppercase",
      detailsGrid: "border-y-2 border-black py-6 font-mono",
      tableWrapper: "border-2 border-black",
      tableHead: "bg-black text-white font-bold tracking-widest uppercase text-xs",
      totalRow: "text-black font-black text-2xl",
      accentText: "text-gray-500 font-bold uppercase tracking-widest text-[10px]"
    }
  }[theme] || {
    docWrapper: "p-8 shadow-2xl rounded-sm",
    header: "mb-12",
    title: "text-4xl font-bold text-slate-900 tracking-tight uppercase",
    detailsGrid: "border-y border-slate-100 py-6",
    tableWrapper: "bg-slate-50 rounded-xl overflow-hidden border border-slate-200",
    tableHead: "bg-slate-100 text-slate-600 border-b border-slate-200",
    totalRow: "text-purple-600",
    accentText: "text-slate-400"
  };

  return (
    <div className={className || "hidden md:flex flex-1 bg-slate-200/50 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-700 p-6 flex-col overflow-y-auto custom-scrollbar"}>
      <div className="flex items-center gap-2 text-slate-500 mb-4 uppercase tracking-wider text-sm font-semibold shrink-0">
        <Eye size={16} /> Live Preview - {theme.replace('-', ' ').toUpperCase()}
      </div>
      
      {/* Document Mock */}
      <div 
        className={`bg-white text-slate-900 min-h-[842px] w-full max-w-[850px] mx-auto flex flex-col relative transition-all duration-300 shrink-0 ${t.docWrapper}`}
        style={typographyStyle}
      >
        
        {/* Header */}
        <div className={`flex justify-between items-start ${t.header}`}>
          <div>
            {businessProfile?.logoUrl ? (
              <div className="w-24 h-24 mb-6">
                 <img src={businessProfile.logoUrl} alt="Logo" className="w-full h-full object-contain object-left" />
              </div>
            ) : (
              <div className="mb-6 flex justify-start">
                 <Logo size="lg" />
              </div>
            )}
            <h1 className={t.title}>{type === 'QUOTE' ? 'QUOTE' : 'INVOICE'}</h1>
            <p className={`mt-2 font-medium ${theme === 'professional' ? 'text-slate-300' : 'text-slate-500'}`}>#{type === 'QUOTE' ? (initialDoc?.quoteNumber || documentNumber) : (initialDoc?.invoiceNumber || documentNumber)}</p>
          </div>
          <div className={`text-right ${theme === 'professional' ? 'text-white' : 'text-slate-600'}`}>
            <p className={`font-bold text-lg mb-1 ${theme === 'professional' ? 'text-white' : 'text-slate-900'}`}>{businessProfile?.name || 'Business Name'}</p>
            <p className="whitespace-pre-line text-sm">{businessProfile?.address}</p>
          </div>
        </div>

        {/* Bill To & Dates Grid */}
        <div className={`grid grid-cols-2 gap-12 ${t.detailsGrid}`}>
           <div>
             <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.accentText}`}>Bill To</p>
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
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.accentText}`}>Date Issued</p>
               <p className="font-medium text-slate-900 text-sm">{new Date().toLocaleDateString()}</p>
             </div>
             {type === 'INVOICE' && dueDate && (
               <div>
                 <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${t.accentText}`}>Due Date</p>
                 <p className="font-medium text-slate-900 text-sm">{new Date(dueDate).toLocaleDateString()}</p>
               </div>
             )}
           </div>
        </div>

        {description && (
          <div className={`mb-8 ${theme === 'professional' ? 'px-8' : ''}`}>
             <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.accentText}`}>Project Description</p>
             <p className="text-slate-700 text-sm">{description}</p>
          </div>
        )}

        {/* Line Items Table */}
        <div className={`flex-1 ${t.tableWrapper}`}>
          <div className={theme === 'modern' ? '' : 'bg-slate-50 rounded-xl overflow-hidden border border-slate-200'}>
            <table className="w-full text-xs text-left">
              <thead className={t.tableHead}>
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
                    <tr key={idx} className={theme === 'modern' && idx % 2 === 0 ? 'bg-purple-50/20' : 'bg-white'}>
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
            <div className={`bg-white p-4 flex justify-end ${theme === 'modern' ? 'mt-4' : 'border-t border-slate-200'}`}>
              <div className="w-full sm:w-2/3 md:w-1/2 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {computedTaxes.map((tx, idx) => (
                  <div key={idx} className="flex justify-between text-slate-600">
                    <span>{tx.name}</span>
                    <span>{tx.isDeduction ? '-' : ''}{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className={`flex justify-between pt-3 mt-2 ${theme === 'modern' ? 'border-t-2 border-purple-200' : 'border-t border-slate-200'}`}>
                  <span className="font-bold text-sm text-slate-900">Total</span>
                  <span className={t.totalRow}>{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info (Notes & Bank) */}
        <div className={`mt-8 space-y-6 ${theme === 'professional' ? 'px-8' : ''}`}>
          {notes && (
            <div className="pt-6 border-t border-slate-100">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.accentText}`}>Terms & Notes</p>
              <p className="text-slate-600 text-xs whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: sanitizedNotes }}></p>
            </div>
          )}

          {bankAccountId && businessProfile.bankAccounts?.find((b: any) => b.id === bankAccountId) && (
            <div className="pt-6 border-t border-slate-100">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.accentText}`}>Payment Details</p>
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

        <div className={`mt-8 pt-8 text-center text-[10px] text-slate-400 w-full border-t border-slate-100 ${theme === 'professional' ? 'px-8' : ''}`}>
          Powered by <span className="font-semibold text-slate-500">{isProUser ? (businessProfile.name || 'BillReve') : 'BillReve'}</span>
        </div>
      </div>
    </div>
  );
};

