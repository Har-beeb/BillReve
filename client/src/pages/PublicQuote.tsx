import { getThemeStyles, type DocumentTheme } from '../utils/documentThemes';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AlertCircle, CheckCircle2, Download, MessageSquare } from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import { generateDocumentPdf } from '../utils/pdfGenerator';
import { db } from '../db/db';
import toast from 'react-hot-toast';

const PublicQuote: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quote, setQuote] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [client, setClient] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterAmount, setCounterAmount] = useState<number | ''>('');
  const [counterMessage, setCounterMessage] = useState('');
  const [isSubmittingCounter, setIsSubmittingCounter] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [isSubmittingDecline, setIsSubmittingDecline] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchQuoteDetails = async () => {
      if (!id) return;
      try {
        // 1. Fetch Quote
        let quoteData: any;
        try {
          const { data, error: quoteError } = await supabase
            .rpc('get_public_quote', { p_local_id: id })
            .maybeSingle();
            
          if (quoteError) throw quoteError;
          if (!data) throw new Error('Quote not found in Supabase');
          quoteData = data;
        } catch (supabaseError) {
          console.log('Supabase fetch failed, trying local DB fallback...', supabaseError);
          const localQuote = await db.quotes.get(id);
          if (localQuote) {
            quoteData = {
              ...localQuote,
              local_id: localQuote.localId,
              client_id: localQuote.clientId,
              user_id: localQuote.userId,
              created_at: localQuote.createdAt,
              quote_number: localQuote.quoteNumber,
            };
          } else {
            throw new Error('Quote not found');
          }
        }
        
        setQuote(quoteData);

        // 2. Fetch Client
        let clientData: any;
        try {
          const { data } = await supabase
            .rpc('get_public_client', { p_local_id: quoteData.client_id })
            .maybeSingle();
          if (data) clientData = data;
          else throw new Error('Client not found');
        } catch (e) {
          const localClient = await db.clients.get(quoteData.client_id);
          clientData = localClient ? { ...localClient, local_id: localClient.localId } : null;
        }
        setClient(clientData);

        // 3. Fetch MSME Profile
        let profileData: any;
        try {
          const { data } = await supabase
            .rpc('get_public_profile', { p_id: quoteData.user_id })
            .maybeSingle();
          if (data) profileData = data;
          else throw new Error('Profile not found');
        } catch (e) {
          const storageStr = localStorage.getItem('billflow-storage');
          if (storageStr) {
            try {
              const state = JSON.parse(storageStr).state;
              const p = state?.businessProfile;
              if (p) {
                profileData = {
                  ...p,
                  bankAccounts: p.bankAccounts || [],
                  logo_url: p.logoUrl
                };
              }
            } catch (err) {
              console.error('Failed to parse local profile', err);
            }
          }
        }
        setProfile(profileData);

      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error fetching quote');
      } finally {
        setLoading(false);
      }
    };

    fetchQuoteDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Quote Not Found</h1>
          <p className="text-slate-500">{error || 'This quote might have been deleted or the link is invalid.'}</p>
        </div>
      </div>
    );
  }

  const isAccepted = quote.status === 'ACCEPTED';
  const isDeclined = quote.status === 'DECLINED';
  const isCountered = quote.status === 'COUNTERED';

  const handleStatusUpdate = async (status: 'ACCEPTED') => {
     try {
        const { error } = await supabase.rpc('update_quote_status_public', {
          p_local_id: id,
          p_status: status
        });
          
        if (error) throw error;
        setQuote({...quote, status});
        setStatusMessage({ type: 'success', text: `Quote successfully accepted!` });
     } catch (err) {
        console.error("Failed to update status", err);
        setStatusMessage({ type: 'error', text: 'Failed to update quote status. Please try again.' });
     }
  };

  const handleDeclineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingDecline) return;
    setIsSubmittingDecline(true);
    try {
        const { error } = await supabase.rpc('update_quote_status_public', {
          p_local_id: id,
          p_status: 'DECLINED',
          p_counter_amount: null,
          p_client_message: declineReason || null
        });
          
        if (error) throw error;
        setQuote({...quote, status: 'DECLINED', clientMessage: declineReason});
        setStatusMessage({ type: 'success', text: 'Quote successfully declined!' });
        setShowDeclineModal(false);
     } catch (err) {
        console.error("Failed to update status", err);
        setStatusMessage({ type: 'error', text: 'Failed to decline quote. Please try again.' });
     } finally {
        setIsSubmittingDecline(false);
     }
  };

  const handleCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterAmount || isSubmittingCounter) return;
    
    setIsSubmittingCounter(true);
    try {
      const amount = Number(counterAmount);
      
      const minAmount = quote.minimum_counter_amount ?? quote.minimumCounterAmount;
      if (minAmount !== undefined && minAmount !== null && amount < minAmount) {
        setStatusMessage({ type: 'error', text: `The business has set a minimum acceptable limit of ${minAmount} for counter offers on this quote. Please enter a valid amount.` });
        setIsSubmittingCounter(false);
        return;
      }

      const { error } = await supabase.rpc('update_quote_status_public', {
        p_local_id: id,
        p_status: 'COUNTERED',
        p_counter_amount: amount,
        p_client_message: counterMessage
      });

      if (error) throw error;
      setQuote({ ...quote, status: 'COUNTERED', counterAmount: amount, clientMessage: counterMessage });
      setStatusMessage({ type: 'success', text: 'Counter offer submitted successfully! The business owner will be notified.' });
      setShowCounterModal(false);
    } catch (err) {
      console.error("Failed to submit counter offer", err);
      setStatusMessage({ type: 'error', text: 'Failed to submit counter offer. Please try again.' });
    } finally {
      setIsSubmittingCounter(false);
    }
  };

  const handleDownload = async () => {
    if (!quote || !profile) return;
    setIsDownloading(true);
    try {
      const docData = {
        ...quote,
        id: quote.local_id || quote.id,
          localId: quote.local_id || quote.id,
          invoiceNumber: quote.invoice_number,
          quoteNumber: quote.quote_number,
          createdAt: quote.created_at,
          updatedAt: quote.updated_at,
          dueDate: quote.due_date,
          expiresAt: quote.expires_at,
          bankAccountId: quote.bank_account_id,
          bankAccountSnapshot: quote.bank_account_snapshot,
          amountPaid: quote.amount_paid
      };
      const profileData = { ...profile, bankAccounts: profile.bank_accounts };
        await generateDocumentPdf(docData, profileData, client, 'QUOTE', true);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };


  const themeStyles = getThemeStyles((quote?.theme || 'standard') as DocumentTheme);
  const theme = quote?.theme || 'standard';

  const headerTextColor = (theme === 'monochrome')
    ? 'text-white'
    : 'text-slate-900';
  const headerSubColor = (theme === 'monochrome')
    ? 'text-white/70'
    : 'text-slate-500';


  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header Actions */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg shadow-sm hover:bg-purple-700 transition-colors text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
        
        {/* Status Message Modal is rendered at the bottom */}

        <div className={`bg-white text-slate-900 w-full flex flex-col relative overflow-hidden transition-all duration-300 ${themeStyles.docWrapper}`}>
          {isAccepted && (
            <div className="absolute top-12 -right-12 transform rotate-45 bg-green-500 text-white font-bold tracking-widest uppercase py-1 px-16 shadow-md z-10">
              ACCEPTED
            </div>
          )}
          {isDeclined && (
            <div className="absolute top-12 -right-12 transform rotate-45 bg-red-500 text-white font-bold tracking-widest uppercase py-1 px-16 shadow-md z-10">
              DECLINED
            </div>
          )}

          <div className={`flex justify-between items-start ${themeStyles.header}`}>
            <div>
              {profile?.logo_url ? (
                <div className="w-32 h-32 mb-6">
                   <img src={profile.logo_url} alt="Logo" className="w-full h-full object-contain object-left" />
                </div>
              ) : (
                <div className="w-24 h-24 mb-6">
                   <img src="/billreve.svg" alt="BillReve Logo" className="w-full h-full object-contain object-left" />
                </div>
              )}
              <h1 className={`text-4xl font-bold tracking-tight ${themeStyles.title}`}>Quote</h1>
              <p className={`mt-2 font-medium ${headerSubColor}`}>#{quote.quote_number || quote.local_id.slice(0,8)}</p>
            </div>
            <div className={`text-right ${headerSubColor}`}>
              <p className={`font-bold text-lg mb-1 ${headerTextColor}`}>{profile?.name || 'Business Name'}</p>
              <p className="whitespace-pre-line text-sm">{profile?.address}</p>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-12 ${themeStyles.detailsGrid}`}>
             <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${themeStyles.accentText}`}>Quote For</p>
               <p className="font-bold text-slate-900 text-lg">{client?.name || 'Unknown Client'}</p>
               <p className="text-slate-500 mt-1">{client?.email}</p>
               {client?.address && <p className="text-slate-500 mt-1 whitespace-pre-line text-sm">{client.address}</p>}
             </div>
             <div className="text-right flex flex-col items-end gap-4">
               <div>
                 <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${themeStyles.accentText}`}>Date Issued</p>
                 <p className="font-medium text-slate-900">{new Date(quote.created_at).toLocaleDateString()}</p>
               </div>
               {(quote.expires_at || quote.expiresAt) && (
                 <div>
                   <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${themeStyles.accentText}`}>Valid Until</p>
                   <p className="font-medium text-slate-900">{new Date(quote.expires_at || quote.expiresAt).toLocaleDateString()}</p>
                 </div>
               )}
             </div>
          </div>

          {quote.description && (
             <div className="px-8 md:px-12 mb-6">
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${themeStyles.accentText}`}>Project Description</p>
               <p className="text-slate-700 text-sm">{quote.description}</p>
             </div>
          )}

          <div className={`flex-1 ${themeStyles.tableWrapper}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left whitespace-nowrap md:whitespace-normal">
                  <thead className={themeStyles.tableHead}>
                    <tr>
                      <th className="px-6 py-4 font-semibold">Description</th>
                      <th className="px-6 py-4 font-semibold text-right">Qty</th>
                      <th className="px-6 py-4 font-semibold text-right">Rate</th>
                      <th className="px-6 py-4 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {quote.items && quote.items.length > 0 ? (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      quote.items.map((i: any, idx: number) => (
                        <tr key={idx} className={idx % 2 !== 0 ? themeStyles.tableStripe : 'bg-white'}>
                          <td className="px-6 py-4 text-slate-900 font-medium whitespace-normal min-w-[200px]">{i.description}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{i.quantity}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{(i.unitPrice || i.unit_price)?.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right text-slate-900 font-bold">{i.amount?.toLocaleString()}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-400 italic">No items found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-white p-6 flex justify-end border-t border-slate-100">
                <div className="w-full md:w-1/2 lg:w-[45%] space-y-3">
                  <div className="flex justify-between gap-6 text-slate-600 text-sm">
                    <span className="shrink-0">Subtotal</span>
                    <span className="break-all text-right">{formatMoney(quote.subtotal, quote.currency)}</span>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {quote.taxes?.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between gap-6 text-slate-600 text-sm">
                      <span className="shrink-0">{t.name}</span>
                      <span className="break-all text-right">{(t.isDeduction || t.is_deduction) ? '-' : ''}{formatMoney(t.amount, quote.currency)}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between items-center gap-8 font-bold text-xl text-slate-900 pt-4 mt-2 ${themeStyles.totalRow}`}>
                    <span className="shrink-0">Total</span>
                    <span className={`break-all text-right ${themeStyles.accentText}`}>{formatMoney(quote.total, quote.currency)}</span>
                  </div>
                </div>
              </div>
          </div>

          {quote.notes && (
            <div className="mt-8 px-8 md:px-12 pt-6 border-t border-slate-100 w-full text-left">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${themeStyles.accentText}`}>Notes / Terms</p>
              <p className="text-slate-600 text-sm whitespace-pre-wrap">{quote.notes}</p>
            </div>
          )}

          {!isAccepted && !isDeclined && !isCountered && !showCounterModal && !showDeclineModal && (
            <div className="mt-12 px-8 md:px-12 flex flex-col sm:flex-row gap-4 justify-end items-center border-t border-slate-100 pt-8">
               {(quote.allow_counter_offer || quote.allowCounterOffer) && (
                 <button 
                   onClick={() => setShowCounterModal(true)}
                   className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                 >
                   <MessageSquare size={18} />
                   Counter Offer
                 </button>
               )}
               <button 
                 onClick={() => setShowDeclineModal(true)}
                 className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
               >
                 Decline Quote
               </button>
               <button 
                 onClick={() => handleStatusUpdate('ACCEPTED')}
                 className="w-full sm:w-auto px-8 py-2.5 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors shadow-sm shadow-purple-600/20"
               >
                 Accept Quote
               </button>
            </div>
          )}
          
          {showCounterModal && (
            <div className="mt-8 mx-8 md:mx-12 p-6 bg-slate-50 rounded-xl border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Make a Counter Offer</h3>
              <form onSubmit={handleCounterOffer} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Proposed Total Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                      {quote.currency || profile?.defaultCurrency || '$'}
                    </span>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={counterAmount}
                      onChange={(e) => setCounterAmount(Number(e.target.value) || '')}
                      className="w-full pl-14 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-black dark:text-black"
                      placeholder="e.g. 5000"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Message (Optional)</label>
                  <textarea
                    rows={3}
                    value={counterMessage}
                    onChange={(e) => setCounterMessage(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-black dark:text-black"
                    placeholder="Briefly explain your counter offer..."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCounterModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingCounter || !counterAmount}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {isSubmittingCounter ? 'Submitting...' : 'Submit Offer'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {showDeclineModal && (
            <div className="mt-8 mx-8 md:mx-12 p-6 bg-red-50 rounded-xl border border-red-100">
              <h3 className="text-lg font-bold text-red-900 mb-2">Decline Quote</h3>
              <p className="text-sm text-red-700 mb-4">Please let the business know why you are declining this quote.</p>
              <form onSubmit={handleDeclineSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-red-800 mb-1">Reason for declining (Optional)</label>
                  <textarea
                    rows={3}
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    className="w-full px-4 py-2 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white text-black dark:text-black"
                    placeholder="E.g. Price is too high, went with another vendor, etc."
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDeclineModal(false)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingDecline}
                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm disabled:opacity-50"
                  >
                    {isSubmittingDecline ? 'Submitting...' : 'Confirm Decline'}
                  </button>
                </div>
              </form>
            </div>
          )}
          
          <div className="mt-12 pb-8 px-8 md:px-12 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-8">
             Powered by <span className="font-semibold">{profile?.is_pro ? (profile?.name || 'BillReve Inc.') : 'BillReve Inc.'}</span>
          </div>

        </div>
      </div>

      {statusMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-slide-up">
            <div className={`p-6 flex flex-col items-center justify-center text-center ${statusMessage.type === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" /> : <AlertCircle className="w-16 h-16 text-red-500 mb-4" />}
              <h2 className={`text-xl font-bold mb-2 ${statusMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {statusMessage.type === 'success' ? 'Success' : 'Error'}
              </h2>
              <p className="text-slate-600 mb-6">{statusMessage.text}</p>
              <button 
                onClick={() => setStatusMessage(null)}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-white transition-transform active:scale-95 ${statusMessage.type === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PublicQuote;
