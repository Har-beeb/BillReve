import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Save, Send, Repeat, Calendar } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { SendDocumentModal } from '../components/SendDocumentModal';
import { type LineItem } from '../components/DocumentItemsTable';
import { DocumentPreview } from '../components/DocumentPreview';
import { EditorHeader } from '../components/editor/EditorHeader';
import { EditorLineItems } from '../components/editor/EditorLineItems';
import { EditorSummary } from '../components/editor/EditorSummary';
import { enhanceAiText } from '../services/ai';
import toast from 'react-hot-toast';
import { syncEngine } from '../services/syncEngine';
import { roundMoney, formatMoney } from '../utils/formatters';

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
  const { businessProfile, taxSettings, isProUser } = useAppStore();
  const aiEnabled = import.meta.env.VITE_ENABLE_AI_FEATURES !== 'false';
  const allClients = useLiveQuery(() => db.clients.toArray()) || [];
  const activeClients = allClients.filter(x => !x.deletedAt);


  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  const nextInvoiceNum = `DRAFT-INV-${randomSuffix}`;
  const nextQuoteNum = `DRAFT-QTE-${randomSuffix}`;
  const documentNumber = type === 'INVOICE' ? nextInvoiceNum : nextQuoteNum;

  const location = useLocation();
  const initialDoc = location.state?.invoice || location.state?.quote;

  // Basic State
  const [localId] = useState<string>(initialDoc?.localId || uuidv4());
  const [newClientLocalId] = useState<string>(uuidv4());
  const [clientId, setClientId] = useState<string>(initialDoc?.clientId || '');
  const defaultNote = 'Thank you for your business! Please note that products in good condition are not returnable after 7 days. Payment is due within the specified terms.';
  const [description, setDescription] = useState<string>(initialDoc?.description || '');
  const [notes, setNotes] = useState<string>(initialDoc?.notes !== undefined ? initialDoc.notes : defaultNote);
  const getInitialDate = () => {
    try {
      const d = initialDoc?.dueDate || initialDoc?.expiresAt;
      if (!d) return '';
      const dateObj = new Date(d);
      if (isNaN(dateObj.getTime())) return '';
      return dateObj.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };
  const [dueDate, setDueDate] = useState<string>(getInitialDate());
  
  const [theme, setTheme] = useState<'standard' | 'professional' | 'modern' | 'classic' | 'monochrome'>(initialDoc?.theme || 'standard');

  // Recurring settings
  const [isRecurring, setIsRecurring] = useState<boolean>(initialDoc?.isRecurring || location.state?.defaultRecurring || false);
  const [recurringFrequency, setRecurringFrequency] = useState<'WEEKLY' | 'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [recurringEndDate, setRecurringEndDate] = useState<string>('');
  // Bank Account Selection
  const defaultBankId = businessProfile.bankAccounts?.find(b => b.isDefault)?.id || businessProfile.bankAccounts?.[0]?.id || '';
      const [bankAccountId, setBankAccountId] = useState<string>(initialDoc && initialDoc.bankAccountId !== undefined ? initialDoc.bankAccountId : defaultBankId);
    const hasModifiedBank = React.useRef(false);

    React.useEffect(() => {
      if (!initialDoc && !hasModifiedBank.current && !bankAccountId) {
        const defId = businessProfile?.bankAccounts?.find((b: any) => b.isDefault)?.id || businessProfile?.bankAccounts?.[0]?.id;
        if (defId) {
          setBankAccountId(defId);
        }
      }
    }, [businessProfile?.bankAccounts, initialDoc, bankAccountId]);

    // Wrap setBankAccountId to mark as modified
    const handleSetBankAccountId = (id: string) => {
      hasModifiedBank.current = true;
      setBankAccountId(id);
    };


  const [items, setItems] = useState<LineItem[]>(initialDoc?.items?.length > 0 ? initialDoc.items.map((i: any) => ({ ...i, id: i.id || uuidv4() })) : [
    { id: uuidv4(), description: '', quantity: 1, unitPrice: 0, amount: 0 }
  ]);
  
  const [isEnhancingNote, setIsEnhancingNote] = useState(false);

  const handleEnhanceNote = async () => {
    if (!notes.trim()) return;
    if (!navigator.onLine) {
      toast.error('AI features require an internet connection.');
      return;
    }
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
      return new Set(initialDoc.taxes.map((t: any) => {
        const found = taxSettings.find(ts => 
          ts.name.toLowerCase() === t.name.toLowerCase() ||
          ts.name.toLowerCase().includes(t.name.toLowerCase()) ||
          t.name.toLowerCase().includes(ts.name.toLowerCase())
        );
        return found?.id;
      }).filter(Boolean));
    }
    return new Set();
  });
  
  const [allowCounterOffer, setAllowCounterOffer] = useState<boolean>(initialDoc?.allowCounterOffer ?? false);
  const [minimumCounterAmount, setMinimumCounterAmount] = useState<number | undefined>(initialDoc?.minimumCounterAmount);

  // Derived Totals
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.amount, 0));
  
  const computedTaxes = taxSettings
    .filter(t => appliedTaxes.has(t.id))
    .map(t => ({
      name: t.name,
      amount: roundMoney(subtotal * (t.rate / 100)),
      isDeduction: t.isDeduction
    }));

  const totalTaxes = roundMoney(computedTaxes.reduce((sum, t) => sum + (t.isDeduction ? -t.amount : t.amount), 0));
  const total = roundMoney(subtotal + totalTaxes);

  // New Client creation state
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');

  // Modal states
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [savedDocumentId, setSavedDocumentId] = useState<string>('');
  const [savedDocumentAmount, setSavedDocumentAmount] = useState<string>('');
  const [savedDocumentClientEmail, setSavedDocumentClientEmail] = useState<string>('');
  const [unsavedDocument, setUnsavedDocument] = useState<any>(null);
  const [unsavedClient, setUnsavedClient] = useState<any>(null);

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
          updated.amount = roundMoney(updated.quantity * updated.unitPrice);
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSaveAndSendClick = () => {
    if (!clientId && !isCreatingClient) {
      toast.error('Please select or create a client');
      return;
    }
    
    let finalClientId = clientId;
    let newClientObj = null;
    if (isCreatingClient && newClientName) {
      finalClientId = newClientLocalId;
      newClientObj = {
        localId: finalClientId,
        name: newClientName,
        email: newClientEmail,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending' as const
      };
      setUnsavedClient(newClientObj);
    } else {
      setUnsavedClient(allClients.find(c => c.localId === finalClientId));
    }

    

        let bankAccountSnapshot = null;


        if (bankAccountId && businessProfile?.bankAccounts) {


          const account = businessProfile.bankAccounts.find((b: any) => b.id === bankAccountId);


          if (account) {


            bankAccountSnapshot = {


              bankName: account.bankName,


              accountNumber: account.accountNumber,


              accountName: account.accountName,


              accountType: account.accountType || undefined,


            };


          }


        }


    


        const docBase = {
      localId: localId,
      organizationId: undefined,
      clientId: finalClientId,
      description: description.trim() !== '' ? description : undefined,
      notes: notes.trim() !== '' ? notes : undefined,
      bankAccountId: type === 'INVOICE' ? (bankAccountId || null) : null,
        ...(type === 'INVOICE' ? { bankAccountSnapshot: bankAccountSnapshot } : {}),
      currency: businessProfile?.currency || 'NGN',
      subtotal,
      taxes: computedTaxes,
      total,
      items: items.filter(i => i.description.trim() !== ''),
      theme,
      createdAt: initialDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const
    };

    let doc: any;
    if (type === 'QUOTE') {
      doc = {
        ...docBase,
        allowCounterOffer,
        minimumCounterAmount,
        quoteNumber: initialDoc?.quoteNumber || documentNumber,
        expiresAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        status: 'SENT' as any,
      };
    } else {
      doc = {
        ...docBase,
        invoiceNumber: initialDoc?.invoiceNumber || documentNumber,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        ...(true && { issuedAt: new Date().toISOString() }),
        status: 'SENT' as any,
      };
    }

    setUnsavedDocument(doc);
    
    setSavedDocumentId(localId);
    setSavedDocumentAmount(formatMoney(total, businessProfile?.currency || 'NGN'));
    setSavedDocumentClientEmail(isCreatingClient ? newClientEmail : allClients.find(c => c.localId === (clientId === 'NEW' ? '' : clientId))?.email || '');
    setIsSendModalOpen(true);
  };

  const handleSave = async (intendedStatus: 'DRAFT' | 'SENT', skipModal = false) => {
    try {
      if (!clientId && !isCreatingClient) {
        toast.error('Please select or create a client');
        return;
      }
      
      const finalStatus = intendedStatus;
      let finalClientId = clientId;
    
    // Create client on the fly if needed
    if (isCreatingClient && newClientName) {
      finalClientId = newClientLocalId;
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
    const finalLocalId = localId;

    

        let bankAccountSnapshot = null;


        if (bankAccountId && businessProfile?.bankAccounts) {


          const account = businessProfile.bankAccounts.find((b: any) => b.id === bankAccountId);


          if (account) {


            bankAccountSnapshot = {


              bankName: account.bankName,


              accountNumber: account.accountNumber,


              accountName: account.accountName,


              accountType: account.accountType || undefined,


            };


          }


        }


    


        const docBase = {
      localId: finalLocalId,
      organizationId: undefined,
      clientId: finalClientId,
      description: description.trim() !== '' ? description : undefined,
      notes: notes.trim() !== '' ? notes : undefined,
      bankAccountId: type === 'INVOICE' ? (bankAccountId || null) : null,
        ...(type === 'INVOICE' ? { bankAccountSnapshot: bankAccountSnapshot } : {}),
      currency: businessProfile?.currency || 'NGN',
      subtotal,
      taxes: computedTaxes,
      total,
      items: items.filter(i => i.description.trim() !== ''),
      theme: theme || 'standard',
      createdAt: initialDoc?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending' as const
    };

    if (type === 'QUOTE') {
      const newQuote = {
        ...docBase,
        allowCounterOffer,
        minimumCounterAmount,
        quoteNumber: initialDoc?.quoteNumber || documentNumber,
        expiresAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        ...(finalStatus === 'SENT' && { issuedAt: new Date().toISOString() }),
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
      
      if (intendedStatus === 'SENT' && !skipModal) {
        setSavedDocumentId(docBase.localId);
        setSavedDocumentAmount(formatMoney(docBase.total, businessProfile?.currency || 'NGN'));
        setSavedDocumentClientEmail(isCreatingClient ? newClientEmail : allClients.find(c => c.localId === finalClientId)?.email || '');
        setIsSendModalOpen(true);
      } else if (!skipModal) {
        navigate('/quotes');
      }
    } else {
      const newInvoice = {
        ...docBase,
        invoiceNumber: initialDoc?.invoiceNumber || documentNumber,
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        status: finalStatus as any,
        amountPaid: initialDoc?.amountPaid || 0,
        isRecurring: isRecurring,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        ...(finalStatus === 'SENT' && { issuedAt: new Date().toISOString() })
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

      // If it's a new recurring invoice, create the schedule
      if (isRecurring && finalStatus === 'SENT' && !isEditing) {
        const nextRun = new Date();
        if (recurringFrequency === 'WEEKLY') nextRun.setDate(nextRun.getDate() + 7);
        if (recurringFrequency === 'MONTHLY') nextRun.setMonth(nextRun.getMonth() + 1);
        if (recurringFrequency === 'YEARLY') nextRun.setFullYear(nextRun.getFullYear() + 1);

        const newSchedule = {
          localId: uuidv4(),
          organizationId: undefined, // handled by sync engine
          clientId: finalClientId,
          templateInvoiceId: finalLocalId,
          frequency: recurringFrequency,
          nextRunDate: nextRun.toISOString().split('T')[0],
          endDate: recurringEndDate ? new Date(recurringEndDate).toISOString().split('T')[0] : undefined,
          status: 'ACTIVE' as const,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          syncStatus: 'pending' as const
        };
        await db.recurringSchedules.add(newSchedule);
        await db.syncQueue.add({
          id: uuidv4(),
          action: 'CREATE',
          entity: 'RECURRING_SCHEDULE',
          payload: newSchedule,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
      
      if (intendedStatus === 'SENT' && !skipModal) {
        setSavedDocumentId(docBase.localId);
        setSavedDocumentAmount(formatMoney(docBase.total, businessProfile?.currency || 'NGN'));
        setSavedDocumentClientEmail(isCreatingClient ? newClientEmail : allClients.find(c => c.localId === finalClientId)?.email || '');
        setIsSendModalOpen(true);
      } else if (!skipModal) {
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-100 dark:bg-slate-950">
        
        {/* Editor Form Pane - Fixed width sidebar */}
        <div className="w-full lg:w-[500px] xl:w-[550px] flex-1 lg:flex-none overflow-y-auto p-6 md:p-8 space-y-8 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/50 shadow-2xl lg:shadow-[10px_0_30px_-15px_rgba(0,0,0,0.1)] z-10 custom-scrollbar">
          
          <EditorHeader
            type={type}
            clients={activeClients}
            clientId={clientId}
            setClientId={setClientId}
            isCreatingClient={isCreatingClient}
            setIsCreatingClient={setIsCreatingClient}
            newClientName={newClientName}
            setNewClientName={setNewClientName}
            newClientEmail={newClientEmail}
            setNewClientEmail={setNewClientEmail}
            description={description}
            setDescription={setDescription}
            dueDate={dueDate}
            setDueDate={setDueDate}
            bankAccountId={bankAccountId}
            setBankAccountId={handleSetBankAccountId}
            businessProfile={businessProfile}
          />

          <hr className="border-slate-100 dark:border-slate-800/50" />

          {type === 'INVOICE' && isProUser && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Repeat className="text-purple-600" size={18} />
                  <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Make Recurring</h2>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {isRecurring && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30 rounded-xl space-y-4 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">Frequency</label>
                      <select
                        value={recurringFrequency}
                        onChange={(e) => setRecurringFrequency(e.target.value as any)}
                        className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none"
                      >
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="YEARLY">Yearly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">End Date (Optional)</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={recurringEndDate}
                          onChange={(e) => setRecurringEndDate(e.target.value)}
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-purple-500/50 outline-none"
                        />
                        <Calendar size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">
                    This invoice will automatically be generated and emailed to the client based on this schedule starting after you send the first one.
                  </p>
                </div>
              )}
            </div>
          )}

          {type === 'INVOICE' && isProUser && (
            <hr className="border-slate-100 dark:border-slate-800/50" />
          )}

          <EditorLineItems
            items={items}
            handleItemChange={handleItemChange}
            handleRemoveItem={handleRemoveItem}
            handleAddItem={handleAddItem}
          />

          <hr className="border-slate-100 dark:border-slate-800/50" />

          <EditorSummary
            type={type}
            currency={businessProfile?.currency || 'NGN'}
            notes={notes}
            setNotes={setNotes}
            aiEnabled={aiEnabled}
            isProUser={isProUser}
            handleEnhanceNote={handleEnhanceNote}
            isEnhancingNote={isEnhancingNote}
            taxSettings={taxSettings}
            appliedTaxes={appliedTaxes}
            setAppliedTaxes={setAppliedTaxes}
            subtotal={subtotal}
            computedTaxes={computedTaxes}
            total={total}
            allowCounterOffer={allowCounterOffer}
            setAllowCounterOffer={setAllowCounterOffer}
            minimumCounterAmount={minimumCounterAmount}
            setMinimumCounterAmount={setMinimumCounterAmount}
          />
          
          {/* Theme Selector */}
          <div className="pt-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Document Theme</h3>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as any)}
              className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-600 outline-none text-slate-900 dark:text-white"
            >
              <option value="standard">Standard (Clean & Simple)</option>
              <option value="professional">Professional (Corporate & Strict)</option>
              <option value="modern">Modern (Sleek & Rounded)</option>
              <option value="classic">Classic (Traditional & Elegant)</option>
              <option value="monochrome">Monochrome (High Contrast)</option>
            </select>
          </div>

          {/* Bottom spacing for mobile to ensure scrollability past FAB */}
          
          <hr className="border-slate-100 dark:border-slate-800/50 my-6" />

          {/* Action Buttons at the bottom of the form */}
          <div className="flex items-center gap-3 pt-4 pb-24 md:pb-12 whitespace-nowrap flex-nowrap">
            <button 
              onClick={() => handleSave('DRAFT')}
              className="flex-1 flex items-center justify-center gap-2 px-2 py-3 rounded-xl text-sm sm:text-base font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-transparent dark:border-slate-700"
            >
              <Save size={18} />
              <span>Save Draft</span>
            </button>
            <button 
              onClick={handleSaveAndSendClick}
              className="flex-1 flex items-center justify-center gap-2 px-2 py-3 rounded-xl text-sm sm:text-base font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors shadow-sm"
            >
              <Send size={18} />
              <span>Save & Send</span>
            </button>
          </div>
        </div>

        {/* Live Preview Pane (Desktop Only) */}
        <DocumentPreview
          businessProfile={businessProfile}
          type={type}
          documentNumber={documentNumber as string}
          initialDoc={initialDoc}
          clientId={clientId}
          clients={activeClients}
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
          currency={businessProfile?.currency || 'NGN'}
          theme={theme}
        />
      </div>

      <SendDocumentModal
        isOpen={isSendModalOpen}
        onClose={handleCloseSendModal}
        documentId={savedDocumentId}
        documentType={type === 'QUOTE' ? 'Quote' : 'Invoice'}
        amount={savedDocumentAmount}
        clientEmail={savedDocumentClientEmail}
        unsavedDocument={unsavedDocument}
        unsavedClient={unsavedClient}
        skipDbUpdate={true}
        onSendSuccess={async () => {
          await handleSave('SENT', true);
          syncEngine.sync();
          navigate(type === 'QUOTE' ? '/quotes' : '/invoices');
        }}
      />
    </div>
  );
};

export default DocumentEditor;

