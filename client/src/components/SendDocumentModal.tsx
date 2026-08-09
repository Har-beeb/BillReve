import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, MessageCircle, Loader2, Sparkles } from 'lucide-react';
import { generateDocumentPdf } from '../utils/pdfGenerator';
import { draftAiEmail } from '../api/ai';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../lib/supabase';
import { ProFeature } from './ui/ProFeature';
import { db } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { syncEngine } from '../services/syncEngine';

interface SendDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  clientEmail?: string;
  documentType: 'Invoice' | 'Quote';
  amount: string;
  onBeforeSend?: (method: 'EMAIL' | 'WHATSAPP') => Promise<void>;
  unsavedDocument?: any;
  unsavedClient?: any;
  onSendSuccess?: (method: 'EMAIL' | 'WHATSAPP') => Promise<void>;
  skipDbUpdate?: boolean;
}

export const SendDocumentModal: React.FC<SendDocumentModalProps> = ({
  isOpen,
  onClose,
  documentId,
  clientEmail = '',
  documentType,
  amount,
  onBeforeSend,
  unsavedDocument,
  unsavedClient,
  onSendSuccess,
  skipDbUpdate
}) => {
  const { businessProfile, isProUser } = useAppStore();
  const [isSending, setIsSending] = useState(false);
  const [customMessage, setCustomMessage] = useState('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [documentDetails, setDocumentDetails] = useState<any>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);

  useEffect(() => {
    if (isOpen && documentId) {
      const loadDetails = async () => {
        const doc = documentType === 'Invoice' 
          ? await db.invoices.get(documentId)
          : await db.quotes.get(documentId);
        
        if (doc) {
          setDocumentDetails(doc);
          const client = await db.clients.get(doc.clientId);
          if (client) setClientDetails(client);
        }
      };
      loadDetails();
    } else {
      setCustomMessage('');
    }
  }, [isOpen, documentId, documentType]);

  const handleDraftEmail = async () => {
    if (!documentDetails || !clientDetails) return;
    if (!navigator.onLine) {
      toast.error('You need to be online to draft emails with AI.');
      return;
    }
    
    setIsDrafting(true);
    try {
      const isOverdue = documentType === 'Invoice' && documentDetails.dueDate && new Date(documentDetails.dueDate) < new Date();
      
      // Fetch client history (past invoices and quotes) to personalize the draft
      const pastInvoices = await db.invoices.where('clientId').equals(clientDetails.localId).filter(x => !x.deletedAt).toArray();
      const pastQuotes = await db.quotes.where('clientId').equals(clientDetails.localId).filter(x => !x.deletedAt).toArray();
      
      const clientHistory = {
        totalInvoices: pastInvoices.length,
        totalPaidInvoices: pastInvoices.filter(i => i.status === 'PAID').length,
        totalQuotes: pastQuotes.length,
        isNewClient: (pastInvoices.length + pastQuotes.length) <= 1,
      };

      const draft = await draftAiEmail({
        documentType: documentType.toUpperCase() as 'QUOTE' | 'INVOICE',
        documentDetails,
        clientDetails,
        clientHistory,
        businessName: businessProfile.name || 'Your Business',
        currency: documentDetails.currency || 'USD',
        isOverdue: isOverdue || false,
        businessProfile
      });
      
      if (draft?.text) {
        setCustomMessage(draft.text);
      }
    } catch (err) {
      console.error('Failed to draft email:', err);
      toast.error('Failed to draft email.');
    } finally {
      setIsDrafting(false);
    }
  };

  if (!isOpen) return null;

  const publicLink = documentType === 'Invoice' 
    ? `${window.location.origin}/pay/${documentId}`
    : `${window.location.origin}/quote/${documentId}`;

  const isOverdue = documentDetails && documentType === 'Invoice' && documentDetails.dueDate && new Date(documentDetails.dueDate) < new Date();

  const handleSendEmail = async () => {
    if (!navigator.onLine) {
      toast.error('You need to be online to send emails.');
      return;
    }
    setIsSending(true);
    try {
      if (onBeforeSend) {
        await onBeforeSend('EMAIL');
      }

      // 1. Get the document and client from IndexedDB or Props
      const document = unsavedDocument || (documentType === 'Invoice' 
        ? await db.invoices.get(documentId)
        : await db.quotes.get(documentId));
      
      if (!document) throw new Error('Document not found');
      
      const client = unsavedClient || await db.clients.get(document.clientId);

      // 2. Generate PDF as base64
      const pdfBase64 = await generateDocumentPdf(document, client, businessProfile, documentType.toUpperCase() as any, false);
      if (!pdfBase64) throw new Error('Failed to generate PDF document');
      
      // 3. Construct HTML
      const subject = isOverdue 
        ? `Payment Reminder: ${documentType} ${(document as any).invoiceNumber || (document as any).quoteNumber || ''} from ${businessProfile.name || 'BillReve'}`
        : `${documentType} ${(document as any).invoiceNumber || (document as any).quoteNumber || ''} from ${businessProfile.name || 'BillReve'}`;
        
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #4F46E5;">${isOverdue ? 'Payment Reminder' : `Your ${documentType} from ${businessProfile.name || 'BillReve'}`}</h2>
          <p>Hi ${client?.name || 'Client'},</p>
          <p>${isOverdue 
            ? `This is a friendly reminder that your ${documentType.toLowerCase()} is now overdue. Please find it attached.` 
            : `Please find your ${documentType.toLowerCase()} attached.`}</p>
          <p><strong>Amount:</strong> ${amount}</p>
          ${(document as any).dueDate ? `<p><strong>Due Date:</strong> ${new Date((document as any).dueDate).toLocaleDateString()}</p>` : ''}
          ${customMessage ? `<div style="padding: 12px; background-color: #f3f4f6; border-left: 4px solid #8b5cf6; margin-bottom: 20px;">
            ${customMessage.split('\n').map(line => line.trim() ? `<p style="margin: 0 0 8px 0; font-size: 14px;">${line}</p>` : '<br/>').join('')}
          </div>` : ''}
          ${publicLink ? `<div style="margin-top: 24px;"><a href="${publicLink}" style="background-color: #8b5cf6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold;">${documentType === 'Invoice' ? (isProUser ? 'View & Pay Online' : 'View Invoice Online') : 'View Quote Online'}</a></div>` : ''}
        </div>
      `;

      // 4. Send to Supabase Edge Function
      const { data: result, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: clientEmail,
          subject,
          html: htmlContent,
          attachments: [
            {
              filename: `${documentType.toLowerCase()}-${(document as any).invoiceNumber || (document as any).quoteNumber || documentId.slice(0,8)}.pdf`,
              content: pdfBase64.split('base64,')[1] || pdfBase64 // Ensure only raw base64 data without URI prefix
            }
          ]
        }
      });
      if (error) throw new Error(error.message);
      if (!result?.success) throw new Error(result?.error?.message || 'Failed to send email');

      // Update status to SENT
      if (!skipDbUpdate) {
        if (documentType === 'Invoice') {
          await db.invoices.update(documentId, { status: 'SENT', issuedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), syncStatus: 'pending' });
          const updatedDoc = await db.invoices.get(documentId);
          if (updatedDoc) await db.syncQueue.add({ id: uuidv4(), action: 'UPDATE', entity: 'INVOICE', payload: updatedDoc as any, status: 'pending', createdAt: new Date().toISOString() });
        } else {
          await db.quotes.update(documentId, { status: 'SENT', issuedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), syncStatus: 'pending' });
          const updatedDoc = await db.quotes.get(documentId);
          if (updatedDoc) await db.syncQueue.add({ id: uuidv4(), action: 'UPDATE', entity: 'QUOTE', payload: updatedDoc as any, status: 'pending', createdAt: new Date().toISOString() });
        }
      }

      // Immediately sync so it appears as SENT on other devices
      syncEngine.sync();
      
      if (onSendSuccess) {
        await onSendSuccess('EMAIL');
      }

      toast.success(isOverdue ? 'Reminder sent successfully!' : `${documentType} sent successfully!`);
      onClose();
    } catch (err) {
      console.error('Failed to send email:', err);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendWhatsApp = async () => {
    try {
      if (onBeforeSend) {
        await onBeforeSend('WHATSAPP');
      }
      
      const defaultText = `Hi there,\n\nPlease find the link to your ${documentType} for the amount of ${amount} below:\n\n${publicLink}\n\nThank you!`;
    const messageToSend = customMessage.trim() ? `${customMessage.trim()}\n\n${publicLink}` : defaultText;
    const text = encodeURIComponent(messageToSend);
    // Using wa.me which will open WhatsApp app or web depending on device
    window.open(`https://wa.me/?text=${text}`, '_blank');
    
    try {
      // Update status to SENT
      if (!skipDbUpdate) {
        if (documentType === 'Invoice') {
          await db.invoices.update(documentId, { status: 'SENT', issuedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), syncStatus: 'pending' });
          const updatedDoc = await db.invoices.get(documentId);
          if (updatedDoc) await db.syncQueue.add({ id: uuidv4(), action: 'UPDATE', entity: 'INVOICE', payload: updatedDoc as any, status: 'pending', createdAt: new Date().toISOString() });
        } else {
          await db.quotes.update(documentId, { status: 'SENT', issuedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), syncStatus: 'pending' });
          const updatedDoc = await db.quotes.get(documentId);
          if (updatedDoc) await db.syncQueue.add({ id: uuidv4(), action: 'UPDATE', entity: 'QUOTE', payload: updatedDoc as any, status: 'pending', createdAt: new Date().toISOString() });
        }
      }
    } catch (e) {
      console.error('Failed to update status', e);
    }
    
    // Immediately sync so it appears as SENT on other devices
    syncEngine.sync();

    if (onSendSuccess) {
      await onSendSuccess('WHATSAPP');
    }

    onClose();
    } catch (err) {
      console.error('Failed to prepare WhatsApp:', err);
      toast.error('Failed to prepare WhatsApp message.');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
      />
      
      {/* Modal */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm relative z-10 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Send {documentType}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Custom Message (Optional)</label>
              <ProFeature isProUser={isProUser} className="inline-block">
                <button
                  onClick={handleDraftEmail}
                  disabled={isDrafting || !documentDetails}
                  className="flex-none px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium rounded-md hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Draft a professional message using AI"
                >
                  {isDrafting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} className={documentType === 'Invoice' && documentDetails?.dueDate && new Date(documentDetails.dueDate) < new Date() ? 'animate-pulse text-red-500' : ''} />}
                  {documentType === 'Invoice' && documentDetails?.dueDate && new Date(documentDetails.dueDate) < new Date() 
                    ? 'AI Draft Reminder' 
                    : 'AI Draft Message'}
                </button>
              </ProFeature>
            </div>
            <div className="relative w-full">
              <textarea
                rows={4}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Add a personal note to the email body..."
                disabled={isDrafting}
                className="w-full p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/50 disabled:opacity-50 transition-opacity resize-none"
              />
              {isDrafting && (
                <div className="absolute inset-0 bg-white dark:bg-slate-800 rounded-lg overflow-hidden border border-purple-200 dark:border-purple-800/50 pointer-events-none p-4 flex flex-col gap-3">
                  <div className="w-3/4 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse"></div>
                  <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-5/6 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                  <div className="w-1/2 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full animate-pulse" style={{ animationDelay: '450ms' }}></div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 dark:via-white/10 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                </div>
              )}
            </div>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            How would you like to send this {documentType.toLowerCase()} to your client?
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleSendEmail}
              disabled={isSending}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:hover:bg-purple-900/40 dark:text-purple-300 rounded-lg transition-colors font-medium border border-purple-200 dark:border-purple-800/50 disabled:opacity-50"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
              {isSending ? 'Sending...' : 'Send via Email (Default)'}
            </button>
            
            <button
              onClick={handleSendWhatsApp}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-green-50 hover:bg-green-100 text-green-700 dark:bg-green-900/20 dark:hover:bg-green-900/40 dark:text-green-300 rounded-lg transition-colors font-medium border border-green-200 dark:border-green-800/50"
            >
              <MessageCircle size={18} />
              Send via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

