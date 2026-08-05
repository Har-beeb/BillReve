import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Send, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { SendDocumentModal } from '../components/SendDocumentModal';
import { DocumentItemsTable, type LineItem } from '../components/DocumentItemsTable';
import { DocumentPreview } from '../components/DocumentPreview';
import { enhanceAiText } from '../api/ai';
import toast from 'react-hot-toast';
import { syncEngine } from '../services/syncEngine';

interface DocumentEditorProps {
  type: 'QUOTE' | 'INVOICE';
}


/**
 * DocumentEditor Component
 * 
 * A unified editor for creating new Quotes or Invoices. Includes a live
 * preview panel on desktop and a robust item/tax calculation engine.
 */
const DocumentEditor: React.FC<DocumentEditorProps> = ({ type }) => {
  const navigate = useNavigate();
  const { businessProfile, taxSettings, user, isProUser } = useAppStore();
  const aiEnabled = import.meta.env.VITE_ENABLE_AI_FEATURES !== 'false';
  const clients = useLiveQuery(() => db.clients.filter(x => !x.deletedAt).toArray()) || [];
  const invoicesList = useLiveQuery(() => db.invoices.filter(x => !x.deletedAt).toArray()) || [];
  const quotesList = useLiveQuery(() => db.quotes.filter(x => !x.deletedAt).toArray()) || [];

  const nextInvoiceNum = `INV-${String(invoicesList.length + 1).padStart(3, '0')}`;
  const nextQuoteNum = `QTE-${String(quotesList.length + 1).padStart(3, '0')}`;
  const documentNumber = type === 'INVOICE' ? nextInvoiceNum : nextQuoteNum;

  const location = useLocation();
  const initialDoc = location.state?.invoice || location.state?.quote;

  // Basic State
  const [clientId, setClientId] = useState<string>(initialDoc?.clientId || '');
  const defaultNote = 'Thank you for your business! Please note that products in good condition are not returnable after 7 days. Payment is due within the specified terms.';
  const [description, setDescription] = useState<string>(initialDoc?.description || '');
  const [notes, setNotes] = useState<string>(initialDoc?.notes !== undefined ? initialDoc.notes : defaultNote);
  const [dueDate, setDueDate] = useState<string>(initialDoc?.dueDate || initialDoc?.expiresAt ? new Date(initialDoc.dueDate || initialDoc.expiresAt).toISOString().split('T')[0] : '');
  
  // Bank Account Selection
  const defaultBankId = businessProfile.bankAccounts?.find(b => b.isDefault)?.id || businessProfile.bankAccounts?.[0]?.id || '';
  const [bankAccountId, setBankAccountId] = useState<string>(initialDoc?.bankAccountId || defaultBankId);

  const [items, setItems] = useState<LineItem[]>(initialDoc?.items?.length > 0 ? initialDoc.items.map((i: any) => ({ ...i, id: i.id || uuidv4() })) : [
    { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  
  const [isEnhancingNote, setIsEnhancingNote] = useState(false);

  const handleEnhanceNote = async () => {
    if (!notes.trim()) return;
    try {
      setIsEnhancingNote(true);
      const enhanced = await enhanceAiText({ text: notes, mode: 'note' });
      if (enhanced?.text) {
        setNotes(enhanced.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsEnhancingNote(false);
    }
  };
  // Tax state
  const [appliedTaxes, setAppliedTaxes] = useState<Set<string>>(() => {
    if (initialDoc?.taxes) {
      return new Set(initialDoc.taxes.map((t: any) => taxSettings.find(ts => ts.name === t.name)?.id).filter(Boolean));
    }
    // No default tax setting property available, so start empty or based on logic if needed
    return new Set();
  });
  
  const [allowCounterOffer, setAllowCounterOffer] = useState<boolean>(initialDoc?.allowCounterOffer ?? false);

  // Derived Totals
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  
  const computedTaxes = taxSettings
    .filter(t => appliedTaxes.has(t.id))
    .map(t => ({
      name: t.name,
      amount: subtotal * (t.rate / 100),
      isDeduction: t.isDeduction
    }));

  const totalTaxes = computedTaxes.reduce((sum, t) => sum + (t.isDeduction ? -t.amount : t.amount), 0);
  const total = subtotal + totalTaxes;

  // New Client creation state
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  // Modal states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [savedDocumentId, setSavedDocumentId] = useState<string>('');
  const [savedDocumentAmount, setSavedDocumentAmount] = useState<string>('');
  const [savedDocumentClientEmail, setSavedDocumentClientEmail] = useState<string>('');

  const handleAddItem = () => {
    setItems([...items, { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        // Auto calculate amount
        if (field === 'quantity' || field === 'unitPrice') {
          updated.amount = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSave = async (intendedStatus: 'DRAFT' | 'SENT') => {
    try {
      if (!clientId && !isCreatingClient) {
        toast.error('Please select or create a client');
        return;
      }
      
      const finalStatus = intendedStatus === 'SENT' ? (initialDoc?.status || 'DRAFT') : intendedStatus;
      let finalClientId = clientId;
    
    // Create client on the fly if needed
    if (isCreatingClient && newClientName) {
      finalClientId = uuidv4();
      const newClient = {
        localId: finalClientId,
        name: newClientName,
        email: newClientEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const
      };
      await db.clients.add(newClient);
      await db.syncQueue.add({
        id: uuidv4(),
        action: 'CREATE',
        entity: 'CLIENT',
        payload: newClient,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }

    const isEditing = !!initialDoc?.localId;
    const finalLocalId = initialDoc?.localId || uuidv4();

    const docBase = {
      localId: finalLocalId,
      userId: user?.id,
      clientId: finalClientId,
      description: description.trim() !== '' ? description : undefined,
      notes: notes.trim() !== '' ? notes : undefined,
      bankAccountId: bankAccountId || undefined,
      currency: 'NGN',
      subtotal,
      taxes: computedTaxes,
      total,
      allowCounterOffer,
      items: items.filter(i => i.description.trim() !== ''),
      createdAt: initialDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const
    };

    if (type === 'QUOTE') {
      const newQuote = {
        ...docBase,
        quoteNumber: initialDoc?.quoteNumber || documentNumber,
        expiresAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        status: finalStatus as any,
      };
      
      if (isEditing) {
        await db.quotes.put(newQuote);
        await db.syncQueue.add({
          id: uuidv4(),
          action: 'UPDATE',
          entity: 'QUOTE',
          payload: newQuote,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      } else {
        await db.quotes.add(newQuote);
        await db.syncQueue.add({
          id: uuidv4(),
          action: 'CREATE',
          entity: 'QUOTE',
          payload: newQuote,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
      
      if (intendedStatus === 'SENT') {
        setSavedDocumentId(docBase.localId);
        setSavedDocumentAmount(docBase.total.toLocaleString(undefined, { minimumFractionDigits: 2 }));
        setSavedDocumentClientEmail(isCreatingClient ? newClientEmail : clients.find(c => c.localId === finalClientId)?.email || '');
        setIsSendModalOpen(true);
      } else {
        navigate('/quotes');
      }
    } else {
      const newInvoice = {
        ...docBase,
        invoiceNumber: initialDoc?.invoiceNumber || documentNumber,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        status: finalStatus as any,
        amountPaid: initialDoc?.amountPaid || 0,
        isRecurring: initialDoc?.isRecurring || false,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
      };
      
      if (isEditing) {
        await db.invoices.put(newInvoice);
        await db.syncQueue.add({
          id: uuidv4(),
          action: 'UPDATE',
          entity: 'INVOICE',
          payload: newInvoice,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      } else {
        await db.invoices.add(newInvoice);
        await db.syncQueue.add({
          id: uuidv4(),
          action: 'CREATE',
          entity: 'INVOICE',
          payload: newInvoice,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
      
      if (intendedStatus === 'SENT') {
        setSavedDocumentId(docBase.localId);
        setSavedDocumentAmount(docBase.total.toLocaleString(undefined, { minimumFractionDigits: 2 }));
        setSavedDocumentClientEmail(isCreatingClient ? newClientEmail : clients.find(c => c.localId === finalClientId)?.email || '');
        setIsSendModalOpen(true);
      } else {
        navigate('/invoices');
      }
      }
      
      // Force sync immediately so public links can be viewed right away
      syncEngine.sync();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCloseSendModal = () => {
    setIsSendModalOpen(false);
    navigate(type === 'QUOTE' ? '/quotes' : '/invoices');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-0rem)] overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center justify-between p-4 md:p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl md:text-2xl font-bold">New {type === 'QUOTE' ? 'Quote' : 'Invoice'}</h1>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => handleSave('DRAFT')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            <Save size={18} />
            <span className="hidden md:inline">Save Draft</span>
          </button>
          <button 
            onClick={() => handleSave('SENT')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
          >
            <Send size={18} />
            <span className="hidden md:inline">Save & Send</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950">
        
        {/* Editor Form Pane - Fixed width sidebar */}
        <div className="w-full lg:w-[500px] xl:w-[550px] flex-1 lg:flex-none overflow-y-auto p-6 md:p-8 space-y-8 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/50 shadow-2xl lg:shadow-[10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 custom-scrollbar">
          
          {/* Client Selection section */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Client Details</h2>
            
            {!isCreatingClient ? (
              <div className="relative group">
                <select 
                  className="appearance-none w-full p-3.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white cursor-pointer outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all group-hover:border-slate-300 dark:group-hover:border-slate-700 font-medium"
                  value={clientId}
                  onChange={(e) => {
                    if (e.target.value === 'NEW') setIsCreatingClient(true);
                    else setClientId(e.target.value);
                  }}
                >
                  <option value="" className="text-slate-400">Select a client...</option>
                  {clients.map(c => (
                    <option key={c.localId} value={c.localId} className="bg-white dark:bg-slate-800">{c.name}</option>
                  ))}
                  <option value="NEW" className="bg-white dark:bg-slate-800 font-semibold text-purple-600 dark:text-purple-400">+ Create New Client</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform group-hover:text-slate-600 dark:group-hover:text-slate-300" size={18} />
              </div>
            ) : (
              <div className="space-y-4 border border-purple-200 dark:border-purple-900/30 bg-purple-50/50 dark:bg-purple-900/10 p-5 rounded-xl">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-purple-600 dark:text-purple-400">New Client</h3>
                  <button onClick={() => setIsCreatingClient(false)} className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium">
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Company / Name</label>
                    <input 
                      type="text" 
                      value={newClientName}
                      onChange={(e) => setNewClientName(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 outline-none transition-all"
                      placeholder="billing@acme.com"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <hr className="border-slate-100 dark:border-slate-800/50" />

          {/* Description & Terms */}
          <div className="space-y-6">
            <div>
               <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Document Details</h2>
               <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Project / Description</label>
               <input 
                 type="text"
                 value={description}
                 onChange={(e) => setDescription(e.target.value)}
                 placeholder={`e.g. Website Redesign ${new Date().getFullYear()}`}
                 className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium"
               />
            </div>
            
            <div>
               <div className="flex justify-between items-center mb-1.5">
                 <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Terms & Notes</label>
                {aiEnabled && isProUser && (
                   <button
                     onClick={handleEnhanceNote}
                     disabled={isEnhancingNote || !notes.trim()}
                     className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                     title="Enhance Terms with AI"
                   >
                     {isEnhancingNote ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                     <span>AI Expand</span>
                   </button>
                )}
               </div>
               <textarea 
                 rows={3}
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 placeholder="Terms, conditions, and notes for the client..."
                 className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all text-sm leading-relaxed"
               />
            </div>
          </div>

          <hr className="border-slate-100 dark:border-slate-800/50" />

          {/* Payment & Dates */}
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Dates & Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">{type === 'QUOTE' ? 'Expiry Date' : 'Due Date'}</label>
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>

              {(type === 'INVOICE' || (businessProfile.bankAccounts && businessProfile.bankAccounts.length > 0)) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Receiving Bank</label>
                  <div className="relative group">
                    <select 
                      className="appearance-none w-full p-3.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white cursor-pointer outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all group-hover:border-slate-300 dark:group-hover:border-slate-700"
                      value={bankAccountId}
                      onChange={(e) => setBankAccountId(e.target.value)}
                    >
                      <option value="">Do not include bank details</option>
                      {businessProfile.bankAccounts?.map(b => (
                        <option key={b.id} value={b.id} className="bg-white dark:bg-slate-800">
                          {b.bankName} - {b.accountNumber}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-transform group-hover:text-slate-600 dark:group-hover:text-slate-300" size={18} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Line Items section */}
          <DocumentItemsTable
            items={items}
            onItemChange={handleItemChange}
            onRemoveItem={handleRemoveItem}
            onAddItem={handleAddItem}
          />

          <hr className="border-slate-100 dark:border-slate-800/50" />

          {/* Tax & Totals section */}
          <div className="space-y-6">
            <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Taxes & Totals</h2>
            
            <div className="flex flex-col gap-8">
              <div className="space-y-3">
                {taxSettings.map(tax => (
                  <label key={tax.id} className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={appliedTaxes.has(tax.id)} 
                        onChange={(e) => {
                          const newSet = new Set(appliedTaxes);
                          if (e.target.checked) newSet.add(tax.id);
                          else newSet.delete(tax.id);
                          setAppliedTaxes(newSet);
                        }}
                        className="w-5 h-5 rounded-md border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-purple-600 focus:ring-purple-500/50 focus:ring-offset-0 transition-all cursor-pointer appearance-none checked:bg-purple-600 checked:border-transparent"
                      />
                      {appliedTaxes.has(tax.id) && (
                        <svg className="absolute w-3.5 h-3.5 text-white pointer-events-none" viewBox="0 0 14 14" fill="none">
                          <path d="M3 8L6 11L11 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className="font-medium text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">Apply {tax.name}</span>
                  </label>
                ))}
              </div>
              
              <div className="bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-800 p-5 rounded-xl space-y-3">
                 <div className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
                   <span>Subtotal</span>
                   <span className="font-medium text-slate-700 dark:text-slate-300">NGN {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                 </div>
                 {computedTaxes.map((t, idx) => (
                   <div key={idx} className="flex justify-between text-slate-500 dark:text-slate-400 text-sm">
                     <span>{t.name}</span>
                     <span className="font-medium text-slate-700 dark:text-slate-300">{t.isDeduction ? '- ' : '+ '}NGN {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                   </div>
                 ))}
                 {computedTaxes.length > 0 && <hr className="border-slate-200 dark:border-slate-700" />}
                 <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between font-bold text-lg">
                   <span className="text-slate-900 dark:text-white">Total</span>
                   <span className="text-purple-600 dark:text-purple-400">NGN {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                 </div>
              </div>
            </div>
          </div>

          {/* Document Settings */}
          {type === 'QUOTE' && (
            <div className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
              <h2 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Document Settings</h2>
              
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative inline-block w-10 h-6">
                  <input 
                    type="checkbox"
                    checked={allowCounterOffer}
                    onChange={(e) => setAllowCounterOffer(e.target.checked)}
                    className="peer appearance-none w-10 h-6 bg-slate-200 dark:bg-slate-700 rounded-full checked:bg-purple-600 dark:checked:bg-purple-500 cursor-pointer transition-colors"
                  />
                  <span className="absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm pointer-events-none"></span>
                </div>
                <span className="font-medium text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                  Allow client to make a counter offer
                </span>
              </label>
            </div>
          )}
          
          {/* Bottom spacing for mobile to ensure scrollability past FAB */}
          <div className="h-20 md:hidden"></div>
        </div>

        {/* Live Preview Pane (Desktop Only) */}
        <DocumentPreview
          businessProfile={businessProfile}
          type={type}
          documentNumber={documentNumber as string}
          initialDoc={initialDoc}
          clientId={clientId}
          clients={clients}
          isCreatingClient={isCreatingClient}
          newClientName={newClientName}
          newClientEmail={newClientEmail}
          dueDate={dueDate}
          items={items}
          subtotal={subtotal}
          computedTaxes={computedTaxes}
          total={total}
          description={description}
          notes={notes}
          bankAccountId={bankAccountId}
        />
      </div>

      <SendDocumentModal
        isOpen={isSendModalOpen}
        onClose={handleCloseSendModal}
        documentId={savedDocumentId}
        documentType={type === 'QUOTE' ? 'Quote' : 'Invoice'}
        amount={savedDocumentAmount}
        clientEmail={savedDocumentClientEmail}
      />
    </div>
  );
};

export default DocumentEditor;
