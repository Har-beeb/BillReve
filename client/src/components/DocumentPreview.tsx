import { getThemeStyles } from '../utils/documentThemes';
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

  const t = getThemeStyles(theme as any);

  // Header text colours — some themes have dark headers, others light
  const headerTextColor = (theme === 'professional' || theme === 'modern' || theme === 'monochrome')
    ? 'text-white'
    : 'text-slate-900';
  const headerSubColor = (theme === 'professional' || theme === 'modern' || theme === 'monochrome')
    ? 'text-white/70'
    : 'text-slate-500';

  return (
    <div className={className || "hidden md:flex flex-1 bg-slate-200/50 dark:bg-slate-900/80 border-l border-slate-200 dark:border-slate-700 p-6 flex-col overflow-y-auto custom-scrollbar"}>
      <div className="flex items-center gap-2 text-slate-500 mb-4 uppercase tracking-wider text-sm font-semibold shrink-0">
        <Eye size={16} /> Live Preview - {theme.replace('-', ' ').toUpperCase()}
      </div>
      
      {/* Document Mock */}
      <div 
        className={`bg-white text-slate-900 min-h-[842px] w-full max-w-[850px] mx-auto flex flex-col relative transition-all duration-300 shrink-0 overflow-hidden ${t.docWrapper}`}
        style={typographyStyle}
      >
        
        {/* Header */}
        <div className={`flex justify-between items-start p-8 ${t.header}`}>
          <div>
            {businessProfile?.logoUrl ? (
              <div className="w-24 h-24 mb-4">
                 <img src={businessProfile.logoUrl} alt="Logo" className="w-full h-full object-contain object-left" />
              </div>
            ) : (
              <div className="mb-4 flex justify-start">
                 <Logo size="lg" />
              </div>
            )}
            <h1 className={`text-3xl font-bold tracking-tight ${t.title}`}>{type === 'QUOTE' ? 'QUOTE' : 'INVOICE'}</h1>
            <p className={`mt-1 font-medium text-sm ${headerSubColor}`}>#{type === 'QUOTE' ? (initialDoc?.quoteNumber || documentNumber) : (initialDoc?.invoiceNumber || documentNumber)}</p>
          </div>
          <div className={`text-right ${headerSubColor}`}>
            <p className={`font-bold text-lg mb-1 ${headerTextColor}`}>{businessProfile?.name || 'Business Name'}</p>
            <p className="whitespace-pre-line text-sm">{businessProfile?.address}</p>
          </div>
        </div>

        {/* Bill To & Dates Grid */}
        <div className={`grid grid-cols-2 gap-12 p-8 ${t.detailsGrid}`}>
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
          <div className="px-8 mb-6">
             <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${t.accentText}`}>Project Description</p>
             <p className="text-slate-700 text-sm">{description}</p>
          </div>
        )}

        {/* Line Items Table */}
        <div className={`flex-1 mx-8 ${t.tableWrapper}`}>
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
                  <tr key={idx} className={idx % 2 !== 0 ? t.tableStripe : 'bg-white'}>
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
          <div className="bg-white p-4 flex justify-end border-t border-slate-100">
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
              <div className={`flex justify-between pt-3 mt-2 ${t.totalRow}`}>
                <span className="font-bold text-sm text-slate-900">Total</span>
                <span className={`font-bold text-sm ${t.accentText}`}>{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info (Notes & Bank) */}
        <div className="mt-8 px-8 space-y-6">
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

        <div className={`mt-8 pb-8 px-8 pt-8 text-center text-[10px] text-slate-400 w-full border-t border-slate-100`}>
          Powered by <span className="font-semibold text-slate-500">{isProUser ? (businessProfile.name || 'BillReve') : 'BillReve'}</span>
        </div>
      </div>
    </div>
  );
};
