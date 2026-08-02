import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PaystackButton } from 'react-paystack';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { CheckCircle2, AlertCircle, Download } from 'lucide-react';
import { formatMoney } from '../utils/formatters';
import { generateDocumentPdf } from '../utils/pdfGenerator';
import { db } from '../db/db';
import { useAppStore } from '../store/useAppStore';
import toast from 'react-hot-toast';

const PublicInvoice: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [invoice, setInvoice] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [client, setClient] = useState<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'SUCCESS' | 'FAILED'>('PENDING');
  const { fontFamily, fontSize } = useAppStore();
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      if (!id) return;
      try {
        // 1. Fetch Invoice
        let invoiceData;
        try {
          const { data, error: invoiceError } = await supabase
            .from('invoices')
            .select('*')
            .eq('local_id', id)
            .maybeSingle();
            
          if (invoiceError) throw invoiceError;
          if (!data) throw new Error('Invoice not found in Supabase');
          invoiceData = data;
        } catch (supabaseError) {
          console.log('Supabase fetch failed, trying local DB fallback...', supabaseError);
          const localInvoice = await db.invoices.get(id);
          if (localInvoice) {
            invoiceData = {
              ...localInvoice,
              local_id: localInvoice.localId,
              client_id: localInvoice.clientId,
              user_id: localInvoice.userId,
              created_at: localInvoice.createdAt,
              amount_paid: localInvoice.amountPaid,
              invoice_number: localInvoice.invoiceNumber,
            };
          } else {
            throw new Error('Invoice not found');
          }
        }
        
        setInvoice(invoiceData);

        // 2. Fetch Client
        let clientData;
        try {
          const { data } = await supabase
            .from('clients')
            .select('*')
            .eq('local_id', invoiceData.client_id)
            .maybeSingle();
          if (data) clientData = data;
          else throw new Error('Client not found');
        } catch (e) {
          const localClient = await db.clients.get(invoiceData.client_id);
          clientData = localClient ? { ...localClient, local_id: localClient.localId } : null;
        }
        setClient(clientData);

        // 3. Fetch MSME Profile
        let profileData;
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', invoiceData.user_id)
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
                  paystack_public_key: p.paystackPublicKey,
                  flutterwave_public_key: p.flutterwavePublicKey,
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
        setError(err instanceof Error ? err.message : 'Error fetching invoice');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [id]);

  const handleDownload = async () => {
    if (!invoice || !profile) return;
    setIsDownloading(true);
    try {
      const docData = {
        ...invoice,
        id: invoice.local_id || invoice.id
      };
      await generateDocumentPdf(docData, profile, client, 'INVOICE', true);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Invoice Not Found</h1>
          <p className="text-slate-500">{error || 'This invoice might have been deleted or the link is invalid.'}</p>
        </div>
      </div>
    );
  }

  const isPaid = invoice.status === 'PAID' || paymentStatus === 'SUCCESS';
  
  // Paystack configuration
  const componentProps = profile?.paystack_public_key ? {
    email: client?.email || 'customer@example.com',
    amount: Math.round((invoice.total - (invoice.amount_paid || 0)) * 100), // Paystack amount is in kobo
    metadata: {
      custom_fields: [
         { display_name: "Invoice ID", variable_name: "invoice_id", value: invoice.local_id },
         { display_name: "Client ID", variable_name: "client_id", value: invoice.client_id }
      ]
    },
    publicKey: profile.paystack_public_key,
    text: "Pay Securely with Paystack",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (reference: any) => {
      console.log('Payment Success:', reference);
      setPaymentStatus('SUCCESS');
      // Optimistic update
    },
    onClose: () => {
      console.log('Payment closed');
    },
  } : null;

  // Flutterwave configuration
  const flutterwaveConfig = profile?.flutterwave_public_key ? {
    public_key: profile.flutterwave_public_key,
    tx_ref: invoice.local_id || invoice.id,
    amount: invoice.total - (invoice.amount_paid || 0),
    currency: invoice.currency || profile.currency || 'USD',
    payment_options: 'card,mobilemoney,ussd',
    customer: {
      email: client?.email || 'customer@example.com',
      name: client?.name || 'Customer Name',
    },
    customizations: {
      title: `Invoice #${invoice.invoice_number || invoice.local_id.slice(0, 8)}`,
      description: 'Payment for services rendered',
      logo: profile?.logo_url || '',
    },
  } : null;

  const handleFlutterwavePayment = useFlutterwave(flutterwaveConfig as any);

  const typographyStyle = profile?.is_pro ? {
    fontFamily: fontFamily === 'Inter' ? undefined : fontFamily,
    fontSize: fontSize === 'small' ? '0.875rem' : fontSize === 'large' ? '1.125rem' : '1rem'
  } : {};

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8" style={typographyStyle}>
        
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
        


        {paymentStatus === 'SUCCESS' && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <h2 className="text-2xl font-bold mb-1">Payment Successful!</h2>
            <p className="text-green-700">Thank you for your payment. Your receipt will be sent shortly.</p>
          </div>
        )}

        <div className="bg-white p-8 md:p-12 shadow-lg w-full flex flex-col relative overflow-hidden">
          {isPaid && (
            <div className="absolute top-12 -right-12 transform rotate-45 bg-green-500 text-white font-bold tracking-widest uppercase py-1 px-16 shadow-md z-10">
              PAID
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
              <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Invoice</h1>
              <p className="text-slate-500 mt-2 font-medium">#{invoice.invoice_number || invoice.local_id.slice(0,8)}</p>
            </div>
            <div className="text-right text-slate-600">
              <p className="font-bold text-slate-900 text-lg mb-1">{profile?.name || 'Business Name'}</p>
              <p className="whitespace-pre-line text-sm">{profile?.address}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-12 mb-12 border-y border-slate-100 py-8">
             <div>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Bill To</p>
               <p className="font-bold text-slate-900 text-lg">{client?.name || 'Unknown Client'}</p>
               <p className="text-slate-500 mt-1">{client?.email}</p>
               {client?.address && <p className="text-slate-500 mt-1 whitespace-pre-line text-sm">{client.address}</p>}
             </div>
             <div className="text-right">
               <div className="mb-4">
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Date Issued</p>
                 <p className="font-medium text-slate-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
               </div>
               {invoice.dueDate && (
                 <div>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Due Date</p>
                   <p className="font-medium text-slate-900">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                 </div>
               )}
             </div>
          </div>

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
                  {invoice.items && invoice.items.length > 0 ? (
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    invoice.items.map((i: any, idx: number) => (
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
                    <span>{formatMoney(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {invoice.taxes?.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400 text-sm">
                      <span>{t.name}</span>
                      <span>{t.isDeduction ? '-' : ''}{formatMoney(t.amount, invoice.currency)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold text-xl text-slate-900 dark:text-white pt-4 border-t border-slate-200 dark:border-slate-700 mt-2">
                    <span>Total</span>
                    <span>{formatMoney(invoice.total, invoice.currency)}</span>
                  </div>
                  {invoice.amount_paid > 0 && (
                    <div className="flex justify-between font-medium text-green-600 text-sm pt-2">
                      <span>Amount Paid</span>
                      <span>-{formatMoney(invoice.amount_paid, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.amount_paid > 0 && invoice.total - invoice.amount_paid > 0 && (
                    <div className="flex justify-between font-bold text-lg text-slate-900 dark:text-white pt-2">
                      <span>Balance Due</span>
                      <span>{formatMoney(invoice.total - invoice.amount_paid, invoice.currency)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 bg-amber-50 text-amber-800 p-4 rounded-xl text-sm border border-amber-100 w-full text-left">
              <span className="font-bold block mb-1">Notes / Terms:</span>
              <span className="whitespace-pre-wrap">{invoice.notes}</span>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mt-12 border-t border-slate-100 pt-8">
             {invoice?.bankAccountId && profile?.bankAccounts?.find((b: any) => b.id === invoice.bankAccountId) && (
                   <div className="text-sm">
                     <p className="font-bold text-slate-700 mb-2 uppercase tracking-wide">Payment Details</p>
                     {(() => {
                        const bank = profile.bankAccounts.find((b: any) => b.id === invoice.bankAccountId);
                        return (
                          <>
                            <p className="text-slate-600"><span className="font-medium">Bank:</span> {bank.bankName}</p>
                            <p className="text-slate-600"><span className="font-medium">Account Name:</span> {bank.accountName}</p>
                            <p className="text-slate-600"><span className="font-medium">Account Number:</span> {bank.accountNumber}</p>
                          </>
                        );
                     })()}
                   </div>
                 )}
             
             <div className="w-full md:w-auto mt-4 md:mt-0 flex flex-col items-center md:items-end gap-3">

               {!isPaid && (
                 <>
                   {/* Conditionally render Paystack for African currencies */}
                   {profile?.is_pro && ['NGN', 'GHS', 'ZAR', 'KES'].includes(invoice.currency || profile?.currency || 'NGN') && componentProps ? (
                     <>
                       <p className="text-sm text-slate-500 mb-1">Or pay instantly via Paystack</p>
                       <PaystackButton 
                         {...componentProps} 
                         className="bg-[#0ba4db] hover:bg-[#0a93c4] text-white font-medium px-8 py-3 rounded-lg shadow-md transition-all active:scale-95 w-full md:w-auto"
                       />
                     </>
                   ) : profile?.is_pro && ['USD', 'EUR', 'GBP', 'CAD'].includes(invoice.currency || profile?.currency) && flutterwaveConfig ? (
                     <>
                       <p className="text-sm text-slate-500 mb-1">Or pay instantly via Flutterwave</p>
                       <button 
                         onClick={() => {
                            handleFlutterwavePayment({
                              callback: (response) => {
                                console.log("Flutterwave payment response:", response);
                                if (response.status === 'successful') {
                                  setPaymentStatus('SUCCESS');
                                }
                                closePaymentModal();
                              },
                              onClose: () => {
                                console.log("Flutterwave modal closed");
                              }
                            });
                         }}
                         className="bg-[#F5A623] hover:bg-[#e0961b] text-white font-medium px-8 py-3 rounded-lg shadow-md transition-all active:scale-95 w-full md:w-auto"
                       >
                         Pay with Flutterwave
                       </button>
                     </>
                   ) : null}
                 </>
               )}
             </div>
          </div>
          

          <div className="mt-12 text-center text-xs text-slate-400">
             Powered by <span className="font-semibold">{profile?.is_pro ? (profile?.name || 'BillReve Inc.') : 'BillReve Inc.'}</span>
          </div>

        </div>
      </div>
    </div>
  );
};

export default PublicInvoice;
