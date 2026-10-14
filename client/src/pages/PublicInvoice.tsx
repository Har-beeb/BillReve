import { getThemeStyles, type DocumentTheme } from '../utils/documentThemes';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { PaystackButton } from 'react-paystack';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';
import { CheckCircle2, AlertCircle, Download, X, Building2, CreditCard } from 'lucide-react';
import { SEO } from '../components/SEO';
import { formatMoney } from '../utils/formatters';
import { toGatewayAmount } from '../utils/money';
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
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'MANUAL' | 'ONLINE' | null>(null);
  const { fontFamily, fontSize } = useAppStore();
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      if (!id) return;
      try {
        // 1. Fetch Invoice
        let invoiceData: any;
        try {
          const { data, error: invoiceError } = await supabase
            .rpc('get_public_invoice', { p_local_id: id })
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
              organization_id: localInvoice.organizationId,
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
        let clientData: any;
        try {
          const { data } = await supabase
            .rpc('get_public_client', { p_local_id: invoiceData.client_id })
            .maybeSingle();
          if (data) clientData = data;
          else throw new Error('Client not found');
        } catch (e) {
          const localClient = await db.clients.get(invoiceData.client_id);
          clientData = localClient ? { ...localClient, local_id: localClient.localId } : null;
        }
        setClient(clientData);

        // 3. Fetch MSME Profile
        let profileData: any;
        try {
          const { data } = await supabase
            .rpc('get_public_profile', { p_id: invoiceData.organization_id })
            .maybeSingle();
          if (data) {
            profileData = data;
            profileData.bankAccounts = (data as any).bank_accounts || [];
          }
          else throw new Error('Profile not found');
        } catch (e) {
          // Offline fallback: grab business profile directly from Zustand state
          const p = useAppStore.getState().businessProfile;
          if (p && p.name && p.name !== 'BillReve') { // Ensure it's not the default empty profile
            profileData = {
              ...p,
              bankAccounts: p.bankAccounts || [],
              paystack_public_key: p.paystackPublicKey,
              flutterwave_public_key: p.flutterwavePublicKey,
              logo_url: p.logoUrl
            };
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
        id: invoice.local_id || invoice.id,
          localId: invoice.local_id || invoice.id,
          invoiceNumber: invoice.invoice_number,
          quoteNumber: invoice.quote_number,
          createdAt: invoice.created_at,
          updatedAt: invoice.updated_at,
          dueDate: invoice.due_date,
          expiresAt: invoice.expires_at,
          bankAccountId: invoice.bank_account_id,
          bankAccountSnapshot: invoice.bank_account_snapshot,
          amountPaid: invoice.amount_paid
      };
      // The remote RPC returns snake_case (`bank_accounts`) but the offline
      // Zustand fallback supplies camelCase (`bankAccounts`). Reading only the
      // snake_case key wiped the array to undefined on the offline path, so an
      // invoice downloaded offline rendered with no payment details at all.
      const profileData = { ...profile, bankAccounts: profile.bank_accounts || profile.bankAccounts || [] };
        await (await import('../utils/pdfGenerator')).generateDocumentPdf({ document: docData, client, profile: profileData, type: 'INVOICE', download: true });
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
  
  const markAsPending = async () => {
    try {
      setPaymentStatus('PENDING'); // Keep optimistic UI if wanted, but realistically we want to show 'PENDING'
      // Actually we need to set a local state or refresh the invoice.
      const { error } = await supabase.rpc('update_invoice_status_public', {
        p_local_id: id,
        p_status: 'PENDING'
      });
      if (error) throw error;
      toast.success('We have notified the business that you have transferred the funds.');
      setInvoice({ ...invoice, status: 'PENDING' });
    } catch (err: any) {
        console.error('Failed to mark as pending:', err);
        if (err?.message?.includes('Rate limit')) {
          toast.error('Too many attempts. Please wait a few minutes and try again.');
        } else {
          toast.error('Failed to update status. Please try again.');
        }
      }
  };

  // Outstanding balance, in MINOR units (kobo/cents) — the unit everything is
  // stored in. Each gateway is handed this value through toGatewayAmount(),
  // which applies that gateway's own convention. Never convert inline here.
  const balanceDueMinor = Math.max(0, (invoice.total || 0) - (invoice.amount_paid || 0));

  // Paystack configuration
  const componentProps = profile?.paystack_public_key ? {
    email: client?.email || 'customer@example.com',
    amount: toGatewayAmount(balanceDueMinor, 'paystack'),
    currency: invoice.currency || profile?.currency || 'NGN',
    metadata: {
      // Send the id both as a flat key and inside custom_fields. Paystack
      // echoes arbitrary metadata back on the webhook, and the flat key is far
      // less error-prone to read than digging through custom_fields.
      invoice_id: invoice.local_id,
      client_id: invoice.client_id,
      custom_fields: [
         { display_name: "Invoice ID", variable_name: "invoice_id", value: invoice.local_id },
         { display_name: "Client ID", variable_name: "client_id", value: invoice.client_id }
      ]
    },
    publicKey: profile.paystack_public_key,
    text: "Pay Securely with Paystack",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: async (reference: any) => {
      console.log('Payment Success:', reference);
      setPaymentStatus('SUCCESS');
      try {
        // Move the invoice out of DRAFT/SENT so the merchant sees activity, but
        // do NOT assert an amount here. The browser is not a trusted source of
        // payment truth — the gateway webhook verifies the amount against the
        // invoice total and is the only thing that may set PAID or amount_paid.
        await supabase.rpc('update_invoice_status_public', {
          p_local_id: id,
          p_status: 'PENDING'
        });
      } catch (err) {
        console.error('Failed to update invoice status in Supabase:', err);
      }
    },
    onClose: () => {
      console.log('Payment closed');
    },
  } : null;

  // Flutterwave configuration
  const flutterwaveConfig = profile?.flutterwave_public_key ? {
    public_key: profile.flutterwave_public_key,
    tx_ref: invoice.local_id || invoice.id,
    amount: toGatewayAmount(balanceDueMinor, 'flutterwave'),
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


  const themeStyles = getThemeStyles((invoice?.theme || 'standard') as DocumentTheme);
  const theme = invoice?.theme || 'standard';

  const headerTextColor = (theme === 'monochrome')
    ? 'text-white'
    : 'text-slate-900';
  const headerSubColor = (theme === 'monochrome')
    ? 'text-white/70'
    : 'text-slate-500';


  return (
    <>
      <SEO 
        title={`Invoice ${invoice.invoice_number || invoice.local_id?.slice(0, 8) || invoice.id?.slice(0, 8)}`} 
        description={`Invoice from ${profile?.businessName || 'us'}`}
        image="https://billreve.app/og-invoice.png"
      />
      <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8" style={typographyStyle}>
        
        {/* Header Actions */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-2 px-5 py-2.5 text-white rounded-lg shadow-sm transition-colors text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed ${
              isPaid
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-purple-600 hover:bg-purple-700'
            }`}
          >
            <Download size={16} />
            {isDownloading ? 'Generating...' : isPaid ? 'Download Receipt (PDF)' : 'Download PDF'}
          </button>
        </div>
        


        {paymentStatus === 'SUCCESS' && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
            <h2 className="text-2xl font-bold mb-1">Payment Successful!</h2>
            <p className="text-green-700">Thank you for your payment. Your receipt will be sent shortly.</p>
          </div>
        )}

        <div className={`bg-white text-slate-900 w-full flex flex-col relative overflow-hidden transition-all duration-300 ${themeStyles.docWrapper}`}>
          {isPaid && (
            <div className="absolute top-12 -right-12 transform rotate-45 bg-green-500 text-white font-bold tracking-widest uppercase py-1 px-16 shadow-md z-10">
              PAID
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
              <h1 className={`text-4xl font-bold tracking-tight ${themeStyles.title}`}>Invoice</h1>
              <p className={`mt-2 font-medium ${headerSubColor}`}>#{invoice.invoice_number || invoice.local_id?.slice(0,8)}</p>
            </div>
            <div className={`text-right ${headerSubColor}`}>
              <p className={`font-bold text-lg mb-1 ${headerTextColor}`}>{profile?.name || 'Business Name'}</p>
              <p className="whitespace-pre-line text-sm">{profile?.address}</p>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-12 ${themeStyles.detailsGrid}`}>
             <div>
               <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${themeStyles.accentText}`}>Bill To</p>
               <p className="font-bold text-slate-900 text-lg">{client?.name || 'Unknown Client'}</p>
               <p className="text-slate-500 mt-1">{client?.email}</p>
               {client?.address && <p className="text-slate-500 mt-1 whitespace-pre-line text-sm">{client.address}</p>}
             </div>
             <div className="text-right flex flex-col items-end gap-4">
               <div>
                 <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${themeStyles.accentText}`}>Date Issued</p>
                 <p className="font-medium text-slate-900">{new Date(invoice.created_at).toLocaleDateString()}</p>
               </div>
               {(invoice.due_date || invoice.dueDate) && (
                 <div>
                   <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${themeStyles.accentText}`}>Due Date</p>
                   <p className="font-medium text-slate-900">{new Date(invoice.due_date || invoice.dueDate).toLocaleDateString()}</p>
                 </div>
               )}
             </div>
          </div>

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
                    {invoice.items && invoice.items.length > 0 ? (
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      invoice.items.map((i: any, idx: number) => (
                        <tr key={idx} className={idx % 2 !== 0 ? themeStyles.tableStripe : 'bg-white'}>
                          <td className="px-6 py-4 text-slate-900 font-medium whitespace-normal min-w-[200px]">{i.description}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{i.quantity}</td>
                          <td className="px-6 py-4 text-right text-slate-600">{formatMoney((i.unitPrice || i.unit_price) || 0, invoice.currency).replace(/^.*?([\d,.]+)/, '$1')}</td>
                          <td className="px-6 py-4 text-right text-slate-900 font-bold">{formatMoney(i.amount || 0, invoice.currency).replace(/^.*?([\d,.]+)/, '$1')}</td>
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
                    <span className="break-all text-right">{formatMoney(invoice.subtotal, invoice.currency)}</span>
                  </div>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {invoice.taxes?.map((t: any, idx: number) => (
                    <div key={idx} className="flex justify-between gap-6 text-slate-600 text-sm">
                      <span className="shrink-0">{t.name}</span>
                      <span className="break-all text-right">{(t.isDeduction || t.is_deduction) ? '-' : ''}{formatMoney(t.amount, invoice.currency)}</span>
                    </div>
                  ))}
                  <div className={`flex justify-between items-center gap-8 font-bold text-xl text-slate-900 pt-4 mt-2 ${themeStyles.totalRow}`}>
                    <span className="shrink-0">Total</span>
                    <span className={`break-all text-right ${themeStyles.accentText}`}>{formatMoney(invoice.total, invoice.currency)}</span>
                  </div>
                  {invoice.amount_paid > 0 && (
                    <div className="flex justify-between gap-6 font-medium text-green-600 text-sm pt-2">
                      <span className="shrink-0">Amount Paid</span>
                      <span className="break-all text-right">-{formatMoney(invoice.amount_paid, invoice.currency)}</span>
                    </div>
                  )}
                  {invoice.amount_paid > 0 && invoice.total - invoice.amount_paid > 0 && (
                    <div className="flex justify-between gap-6 font-bold text-lg text-slate-900 pt-2">
                      <span className="shrink-0">Balance Due</span>
                      <span className="break-all text-right">{formatMoney(invoice.total - invoice.amount_paid, invoice.currency)}</span>
                    </div>
                  )}
                </div>
              </div>
          </div>

          {invoice.notes && (
            <div className="mt-8 px-8 md:px-12 pt-6 border-t border-slate-100 w-full text-left">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${themeStyles.accentText}`}>Notes / Terms</p>
              <p className="text-slate-600 text-sm whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}


          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mt-8 border-t border-slate-100 pt-8 px-8 md:px-12">
             {(() => {
                const actualBankId = invoice?.bank_account_id || invoice?.bankAccountId;
                let actualBankAccounts = profile?.bank_accounts || profile?.bankAccounts || [];
                const bank = invoice.bank_account_snapshot || invoice.bankAccountSnapshot || actualBankAccounts.find((b: any) => String(b.id) === String(actualBankId));
                
                const hasOnlinePayment = (profile?.is_pro && ['NGN', 'GHS', 'ZAR', 'KES'].includes(invoice.currency || profile?.currency || 'NGN') && componentProps) ||
                                       (profile?.is_pro && ['USD', 'EUR', 'GBP', 'CAD'].includes(invoice.currency || profile?.currency) && flutterwaveConfig);

                return (
                  <div className="w-full flex justify-center md:justify-end">
                    {!isPaid && invoice.status === 'PENDING' ? (
                      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-4 py-3 rounded-xl border border-amber-200">
                        <AlertCircle size={20} />
                        <span className="font-semibold">Payment verification pending</span>
                      </div>
                    ) : !isPaid ? (
                      <>
                        <button 
                          onClick={() => setIsPaymentModalOpen(true)}
                          className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-10 py-4 rounded-xl font-bold transition-all shadow-lg active:scale-95 text-lg"
                        >
                          Pay Now
                        </button>

                        {isPaymentModalOpen && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="font-bold text-lg text-slate-900">Make Payment</h3>
                                <button onClick={() => { setIsPaymentModalOpen(false); setPaymentMethod(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
                                  <X size={20} />
                                </button>
                              </div>

                              <div className="p-6">
                                {!paymentMethod ? (
                                  <div className="space-y-4">
                                    <p className="text-slate-500 mb-6 text-sm">How would you like to pay this invoice?</p>
                                    
                                    {hasOnlinePayment && (
                                      <button 
                                        onClick={() => setPaymentMethod('ONLINE')}
                                        className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-purple-500 hover:bg-purple-50 transition-all group text-left"
                                      >
                                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                          <CreditCard size={24} />
                                        </div>
                                        <div>
                                          <h4 className="font-bold text-slate-900">Pay Online</h4>
                                          <p className="text-sm text-slate-500">Instant secure payment</p>
                                        </div>
                                      </button>
                                    )}

                                    <button 
                                      onClick={() => setPaymentMethod('MANUAL')}
                                      className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
                                    >
                                      <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <Building2 size={24} />
                                      </div>
                                      <div>
                                        <h4 className="font-bold text-slate-900">Bank Transfer</h4>
                                        <p className="text-sm text-slate-500">Manual wire transfer</p>
                                      </div>
                                    </button>
                                  </div>
                                ) : paymentMethod === 'MANUAL' ? (
                                  <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                                    <button onClick={() => setPaymentMethod(null)} className="text-sm text-purple-600 font-medium hover:underline mb-2 block">&larr; Back to options</button>
                                    
                                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                      {bank ? (
                                        <div className="space-y-3">
                                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bank Details</p>
                                          <div>
                                            <p className="text-xs text-slate-500">Bank Name</p>
                                            <p className="font-bold text-slate-900">{bank.bankName || bank.bank_name}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-500">Account Name</p>
                                            <p className="font-bold text-slate-900">{bank.accountName || bank.account_name}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-slate-500">Account Number</p>
                                            <p className="font-bold text-slate-900 text-lg tracking-widest">{bank.accountNumber || bank.account_number}</p>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-center py-6 text-slate-500 italic">
                                          Account details not set by merchant.
                                        </div>
                                      )}
                                    </div>

                                    <div className="pt-2">
                                      <button 
                                        onClick={() => { markAsPending(); setIsPaymentModalOpen(false); }}
                                        className="w-full bg-slate-900 hover:bg-black text-white px-6 py-4 rounded-xl font-bold transition-colors shadow-lg active:scale-95"
                                      >
                                        I've transferred the funds
                                      </button>
                                      <p className="text-xs text-center text-slate-400 mt-4">Click this only after you have completed the transfer.</p>
                                    </div>
                                  </div>
                                ) : paymentMethod === 'ONLINE' ? (
                                  <div className="space-y-6 animate-in slide-in-from-right-8 duration-300">
                                    <button onClick={() => setPaymentMethod(null)} className="text-sm text-purple-600 font-medium hover:underline mb-2 block">&larr; Back to options</button>
                                    
                                    <div className="pt-4 space-y-4">
                                      {profile?.is_pro && ['NGN', 'GHS', 'ZAR', 'KES'].includes(invoice.currency || profile?.currency || 'NGN') && componentProps && (
                                        <PaystackButton 
                                          {...componentProps} 
                                          className="bg-[#0ba4db] hover:bg-[#0a93c4] text-white font-medium px-8 py-4 rounded-xl shadow-lg transition-all active:scale-95 w-full text-lg text-center flex justify-center items-center"
                                        />
                                      )}
                                      
                                      {profile?.is_pro && ['USD', 'EUR', 'GBP', 'CAD'].includes(invoice.currency || profile?.currency) && flutterwaveConfig && (
                                        <button 
                                          onClick={() => {
                                            handleFlutterwavePayment({
                                              callback: async (response) => {
                                                console.log("Flutterwave payment response:", response);
                                                if (response.status === 'successful') {
                                                  setPaymentStatus('SUCCESS');
                                                  try {
                                                    // Status only — the webhook verifies the
                                                    // amount and owns amount_paid / PAID.
                                                    await supabase.rpc('update_invoice_status_public', {
                                                      p_local_id: id,
                                                      p_status: 'PENDING'
                                                    });
                                                  } catch (err) {
                                                    console.error('Failed to update invoice status in Supabase:', err);
                                                  }
                                                }
                                                closePaymentModal();
                                                setIsPaymentModalOpen(false);
                                              },
                                              onClose: () => {
                                                console.log("Flutterwave modal closed");
                                              }
                                            });
                                          }}
                                          className="bg-[#F5A623] hover:bg-[#e0961b] text-white font-medium px-8 py-4 rounded-xl shadow-lg transition-all active:scale-95 w-full text-lg"
                                        >
                                          Pay with Flutterwave
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : null}
                  </div>
                );
             })()}
          </div>
          

          <div className="mt-12 pb-8 px-8 text-center text-[10px] text-slate-400">    </div>
          

          <div className="mt-12 pb-8 px-8 text-center text-[10px] text-slate-400">
             Powered by <span className="font-semibold">{profile?.is_pro ? (profile?.name || 'BillReve Inc.') : 'BillReve Inc.'}</span>
          </div>

        </div>
      </div>
    </div>
    </>
  );
};

export default PublicInvoice;
