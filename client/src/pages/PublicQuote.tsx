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
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchQuoteDetails = async () => {
      if (!id) return;
      try {
        // 1. Fetch Quote
        let quoteData;
        try {
          const { data, error: quoteError } = await supabase
            .from('quotes')
            .select('*')
            .eq('local_id', id)
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
        let clientData;
        try {
          const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('local_id', quoteData.client_id)
            .maybeSingle();
          if (data) clientData = data;
          else throw new Error('Client not found');
        } catch (e) {
          const localClient = await db.clients.get(quoteData.client_id);
          clientData = localClient ? { ...localClient, local_id: localClient.localId } : null;
        }
        setClient(clientData);

        // 3. Fetch MSME Profile
        let profileData;
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', quoteData.user_id)
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

  const handleStatusUpdate = async (status: 'ACCEPTED' | 'DECLINED') => {
     try {
        const { error } = await supabase.rpc('update_quote_status_public', {
          p_local_id: id,
          p_status: status
        });
          
        if (error) throw error;
        setQuote({...quote, status});
        setStatusMessage({ type: 'success', text: `Quote successfully ${status.toLowerCase()}!` });
     } catch (err) {
        console.error("Failed to update status", err);
        setStatusMessage({ type: 'error', text: 'Failed to update quote status. Please try again.' });
     }
  };

  const handleCounterOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterAmount || isSubmittingCounter) return;
    
    setIsSubmittingCounter(true);
    try {
      const amount = Number(counterAmount);
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
        id: quote.local_id || quote.id
      };
      await generateDocumentPdf(docData, profile, client, 'QUOTE', true);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

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
        
        {statusMessage && (
          <div className={`${statusMessage.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'} border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm`}>
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" /> : <AlertCircle className="w-12 h-12 text-red-500 mb-3" />}
            <h2 className="text-2xl font-bold mb-1">{statusMessage.text}</h2>
          </div>
        )}

        <div className="bg-white p-8 md:p-12 shadow-lg w-full flex flex-col relative overflow-hidden">
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

          <div className="flex justify-between items-start mb-12">
            <div>
              {profile?.logo_url ? (
                <div className="w-32 h-32 mb-6">
                   <img src={profile.logo_url} alt="Logo" className="w-full h-full object-contain object-left" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-purple-600 flex items-center justify-center mb-6">
                   <div className="w-8 h-8 bg-white rounded-md transform rotate-45" />
                </div>
              )}
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Quote</h1>
              <p className="text-slate-500 mt-2 font-medium">#{quote.quote_number || quote.local_id.slice(0,8)}</p>
            </div>
            <div className="text-right text-slate-600">
              <p className="font-bold text-slate-900 text-lg mb-1">{profile?.name || 'Business Name'}</p>
              <p className="whitespace-pre-line text-sm">{profile?.address}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12 border-y border-slate-100 py-8">
             <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quote For</p>
               <p className="font-bold text-slate-900 text-lg">{client?.name || 'Unknown Client'}</p>
               <p className="text-slate-500 mt-1">{client?.email}</p>
               {client?.address && <p className="text-slate-500 mt-1 whitespace-pre-line text-sm">{client.address}</p>}
             </div>
             <div className="text-right">
               <div className="mb-4">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
                 <p className="font-medium text-slate-900">{new Date(quote.created_at).toLocaleDateString()}</p>
               </div>
               <div>
                 <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date</p>
                 <p className="font-medium text-slate-900 text-sm">{quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'N/A'}</p>
               </div>
             </div>
          </div>

          {quote.description && (
             <div className="mb-8">
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Project Description</p>
               <p className="text-slate-700">{quote.description}</p>
             </div>
          )}

          <div className="flex-1">
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-6 py-4 font-semibold">Description</th>
                    <th className="px-6 py-4 font-semibold text-right">Qty</th>
                    <th className="px-6 py-4 font-semibold text-right">Rate</th>
                    <th className="px-6 py-4 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quote.items && quote.items.length > 0 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    quote.items.map((i: any, idx: number) => (
                      <tr key={idx} className="bg-white dark:bg-slate-900 hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">{i.description}</td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{i.quantity}</td>
                        <td className="px-6 py-4 text-right text-slate-600 dark:text-slate-400">{i.unitPrice?.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right text-slate-900 dark:text-slate-100 font-bold">{i.amount?.toLocaleString()}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 italic">No items found</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="bg-white dark:bg-slate-900 p-6 flex justify-end border-t border-slate-200 dark:border-slate-700">
                <div className="w-full md:w-1/2 lg:w-1/3 space-y-3">
                  <div className="flex justify-between text-slate-600 dark:text-slate-400 text-sm">
                    <span>Subtotal</span>
                    <span>{formatMoney(quote.subtotal, quote.currency)}</span>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {quote.taxes?.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400 text-sm">
                      <span>{t.name}</span>
                      <span>{t.isDeduction ? '-' : ''}{formatMoney(t.amount, quote.currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-xl text-slate-900 dark:text-white pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                    <span>Total</span>
                    <span>{formatMoney(quote.total, quote.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {quote.notes && (
            <div className="mt-8 bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-100 w-full text-left">
              <span className="font-bold block mb-1">Notes / Terms:</span>
              <span className="whitespace-pre-wrap">{quote.notes}</span>
            </div>
          )}

          {!isAccepted && !isDeclined && !isCountered && (
            <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-end items-center border-t border-slate-100 pt-8">
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
                 onClick={() => handleStatusUpdate('DECLINED')}
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
            <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
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
                      className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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
          
          <div className="mt-12 text-center text-xs text-slate-400 border-t border-slate-100 pt-8">
             Powered by <span className="font-semibold">{profile?.is_pro ? (profile?.name || 'BillReve Inc.') : 'BillReve Inc.'}</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicQuote;
