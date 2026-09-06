import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, X, Send, Loader2, User, Copy, Check, CheckCircle, Bot, Sparkles } from 'lucide-react';
import { db } from '../db/db';
import { chatWithRevenue } from '../api/ai';
import { useAppStore } from '../store/useAppStore';
import { useQuota } from '../hooks/useQuota';
import { SendDocumentModal } from './SendDocumentModal';
import { v4 as uuidv4 } from 'uuid';
import { syncEngine } from '../services/syncEngine';

interface Action {
  type: string;
  payload: any;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  action?: Action;
}

export const RevenueChat: React.FC = () => {
  const { mobileNavStyle, businessProfile, clients: storeClients, incrementAiPrompts } = useAppStore();
  const { checkQuota } = useQuota();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [sendModalConfig, setSendModalConfig] = useState({ isOpen: false, documentId: '', documentType: 'Invoice' as 'Invoice' | 'Quote' });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Hi! I am your Revenue AI. Ask me anything about your finances.\n\n💡 **Tip:** Type `/` to see quick actions (like creating an invoice), or use `@` to tag a specific client!',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (localStorage.getItem('billreve_ai_used') !== 'true') {
        localStorage.setItem('billreve_ai_used', 'true');
        window.dispatchEvent(new Event('storage'));
      }
    }
    
    if (!isTyping && isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [isTyping, isOpen]);

  const SUGGESTED_PROMPTS = [
    "/create",
    "Who owes me the most money?",
    "/help",
    "Who is my best client?"
  ];

  // Optional: render nothing during SSR if we're worried about document being undefined,
  // but since this is a pure CSR React app, document.body is always available.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    
    const handleOpenChat = () => setIsOpen(true);
    document.addEventListener('open-revenue-chat', handleOpenChat);
    return () => document.removeEventListener('open-revenue-chat', handleOpenChat);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const stripSensitiveData = (data: any[], type: 'client' | 'invoice' | 'quote') => {
    return data.map(item => {
      if (type === 'client') {
        return {
          id: item.localId,
          name: item.name
        };
      }
      return {
        id: item.localId,
        clientId: item.clientId,
        status: item.status,
        total: item.total,
        subtotal: item.subtotal,
        currency: item.currency,
        issueDate: item.issueDate,
        dueDate: item.dueDate,
        items: item.items?.map((i: any) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount
        }))
      };
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    
    // Intercept /help command locally
    if (!checkQuota('ai_prompt')) return;

    if (userMsg.toLowerCase() === '/help') {
      setMessages(prev => [
        ...prev, 
        { id: Date.now().toString(), role: 'user', content: userMsg, timestamp: new Date() },
        { 
          id: (Date.now() + 1).toString(), 
          role: 'ai', 
          content: `### 💼 Available Commands\n\n**Slash Commands**\n* \`/create\` - Start the document creation wizard (Invoice, Quote, or Client)\n* \`/edit\` - Edit an existing record\n* \`/send email\` - Draft an email to a client\n* \`/help\` - Show this help menu\n\n**Mentions**\n* Use **\`@\`** to tag clients directly from your database and get a financial summary (e.g. \`@Dangote Group\`).\n\n**Conversational Actions**\nJust ask me to delete an invoice, edit a client's details, or draft an email, and I'll do it for you!`, 
          timestamp: new Date() 
        }
      ]);
      return;
    }

    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg, timestamp: new Date() }]);
    setIsTyping(true);

    try {
      // 1. Fetch data from DB
      const rawInvoices = await db.invoices.filter(x => !x.deletedAt).toArray();
      const rawQuotes = await db.quotes.filter(x => !x.deletedAt).toArray();
      const rawClients = await db.clients.filter(x => !x.deletedAt).toArray();

      // 2. Strip sensitive info
      const invoices = stripSensitiveData(rawInvoices, 'invoice');
      const quotes = stripSensitiveData(rawQuotes, 'quote');
      const clients = stripSensitiveData(rawClients, 'client');

      // 3. Send to API
      incrementAiPrompts();
      const result = await chatWithRevenue({
        prompt: userMsg,
        data: { invoices, quotes, clients },
        businessProfile,
        currentView: location.pathname,
        history: messages.slice(-20).map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))
      });

      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'ai', 
          content: result.text || 'I could not process that.', 
          timestamp: new Date(),
          action: result.action 
        }
      ]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `I'm having trouble connecting right now. Please try again in a moment.`, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleExecuteAction = async (msgId: string, action: Action) => {
    try {
      // Remove the action from the original message so it doesn't render duplicate buttons
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, action: undefined } : m));
      
      const now = new Date().toISOString();
      if (action.type === 'CREATE_INVOICE' || action.type === 'CREATE_QUOTE') {
        const payload = action.payload;
        
        if (!payload.clientId) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'ai',
            content: `I need a client to assign this ${action.type === 'CREATE_INVOICE' ? 'invoice' : 'quote'} to! Please provide the name of the client you want to use, or ask me to create a new one first.`,
            timestamp: new Date()
          }]);
          return;
        }
        const formattedItems = (payload.items || []).map((item: any) => {
          const qty = item.quantity || 1;
          const price = item.unitPrice || item.rate || item.amount || 0;
          return {
            id: item.id || Date.now().toString() + Math.random().toString(),
            description: item.description || 'Item',
            quantity: qty,
            unitPrice: price,
            amount: qty * price
          };
        });
        
        const subtotal = formattedItems.reduce((sum: number, item: any) => sum + item.amount, 0) || (payload.amount || 0);
        let total = subtotal;
        
        const formattedTaxes = (payload.taxes || []).map((t: any) => {
          const taxAmt = t.type === 'PERCENTAGE' ? (subtotal * (t.rate / 100)) : t.rate;
          return {
            id: t.id || Date.now().toString() + Math.random().toString(),
            name: t.name || 'Tax',
            rate: t.rate || 0,
            type: t.type || 'PERCENTAGE',
            amount: taxAmt
          };
        });
        
        formattedTaxes.forEach((t: any) => {
          total += t.amount || 0;
        });
        
        const invoiceCount = await db.invoices.count();
        const quoteCount = await db.quotes.count();
        const nextNum = action.type === 'CREATE_INVOICE' 
          ? `INV-${String(invoiceCount + 1).padStart(3, '0')}`
          : `QTE-${String(quoteCount + 1).padStart(3, '0')}`;
        
        if (action.type === 'CREATE_INVOICE') {
          const newInvoice = {
            localId: uuidv4(),
            clientId: payload.clientId,
            invoiceNumber: nextNum,
            description: payload.description,
            notes: payload.notes || '',
            dueDate: payload.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: formattedItems,
            subtotal: subtotal,
            total: total,
            status: 'DRAFT' as const,
            currency: businessProfile.currency || 'USD',
            taxes: formattedTaxes,
            amountPaid: 0,
            isRecurring: false,
            syncStatus: 'pending' as const,
            createdAt: now,
            updatedAt: now
          };
          await db.invoices.add(newInvoice as any);
          useAppStore.getState().addInvoice(newInvoice as any);
          await db.syncQueue.add({
            id: uuidv4(),
            action: 'CREATE',
            entity: 'INVOICE',
            payload: newInvoice,
            status: 'pending',
            createdAt: now
          });
          
          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'ai',
              content: `Your invoice has been created successfully! What would you like to do next?`,
              timestamp: new Date(),
              action: {
                type: 'DOCUMENT_CREATED',
                payload: { documentId: newInvoice.localId, documentType: 'Invoice', rawDoc: newInvoice }
              }
            }]);
          }, 500);
        } else {
          const newQuote = {
            localId: uuidv4(),
            clientId: payload.clientId,
            quoteNumber: nextNum,
            description: payload.description,
            notes: payload.notes || '',
            expiresAt: payload.expiresAt || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            items: formattedItems,
            subtotal: subtotal,
            total: total,
            status: 'DRAFT' as const,
            currency: businessProfile.currency || 'USD',
            taxes: formattedTaxes,
            allowCounterOffer: payload.allowCounterOffer ?? false,
            minimumCounterAmount: payload.minimumCounterAmount,
            syncStatus: 'pending' as const,
            createdAt: now,
            updatedAt: now
          };
          await db.quotes.add(newQuote as any);
          useAppStore.getState().addQuote(newQuote as any);
          await db.syncQueue.add({
            id: uuidv4(),
            action: 'CREATE',
            entity: 'QUOTE',
            payload: newQuote,
            status: 'pending',
            createdAt: now
          });

          setTimeout(() => {
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'ai',
              content: `Your quote has been created successfully! What would you like to do next?`,
              timestamp: new Date(),
              action: {
                type: 'DOCUMENT_CREATED',
                payload: { documentId: newQuote.localId, documentType: 'Quote', rawDoc: newQuote }
              }
            }]);
          }, 500);
        }
        syncEngine.sync();
      } else if (action.type === 'DELETE_INVOICE') {
        await db.invoices.update(action.payload.invoiceId, { deletedAt: now, syncStatus: 'pending' });
        syncEngine.sync();
      } else if (action.type === 'DELETE_QUOTE') {
        await db.quotes.update(action.payload.quoteId, { deletedAt: now, syncStatus: 'pending' });
        syncEngine.sync();
      } else if (action.type === 'CREATE_CLIENT') {
        const payload = action.payload;
        const newClient = {
          localId: uuidv4(),
          name: payload.name || 'New Client',
          email: payload.email || '',
          phone: '',
          address: '',
          syncStatus: 'pending' as const,
          createdAt: now,
          updatedAt: now
        };
        await db.clients.add(newClient);
        useAppStore.getState().addClient(newClient);
        await db.syncQueue.add({
          id: uuidv4(),
          action: 'CREATE',
          entity: 'CLIENT',
          payload: newClient,
          status: 'pending',
          createdAt: now
        });
        syncEngine.sync();
      } else if (action.type === 'DELETE_CLIENT') {
        await db.clients.update(action.payload.clientId, { deletedAt: now, syncStatus: 'pending' });
        syncEngine.sync();
      } else if (action.type === 'SEND_DOCUMENT') {
        setSendModalConfig({
          isOpen: true,
          documentId: action.payload.documentId,
          documentType: action.payload.documentType
        });
      } else if (action.type === 'NAVIGATE_EDIT') {
        navigate(action.payload.route);
        setIsOpen(false);
      }
      
      // Update message to remove the action so it doesn't show confirmation anymore
      const updatedMessages = messages.map(m => m.id === msgId ? { ...m, action: undefined, content: m.content + '\n\n**✅ Action Executed Successfully**' } : m);
      setMessages(updatedMessages);
      
      // Automatically prompt the AI to continue the conversation without needing the user to press "okay"
      setIsTyping(true);
      const rawInvoices = await db.invoices.filter(x => !x.deletedAt).toArray();
      const rawQuotes = await db.quotes.filter(x => !x.deletedAt).toArray();
      const rawClients = await db.clients.filter(x => !x.deletedAt).toArray();
      
      const invoices = stripSensitiveData(rawInvoices, 'invoice');
      const quotes = stripSensitiveData(rawQuotes, 'quote');
      const clients = stripSensitiveData(rawClients, 'client');
      
      incrementAiPrompts();
      const result = await chatWithRevenue({
        prompt: "The action was executed successfully! Acknowledge this briefly and ask if there is anything else I need help with. DO NOT include an 'action' object in your JSON response.",
        data: { invoices, quotes, clients },
        businessProfile: useAppStore.getState().businessProfile,
        currentView: window.location.pathname,
        history: updatedMessages.slice(-20).map(m => ({
          role: m.role === 'ai' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }))
      });
      
      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'ai', 
          content: result.text || 'Action complete!', 
          timestamp: new Date(),
          // Forcefully omit action to prevent duplicate button loops
          action: undefined 
        }
      ]);
      setIsTyping(false);
      
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `Failed to execute action: ${err.message}`, timestamp: new Date() }]);
      setIsTyping(false);
    }
  };

  const formatMessage = (text: string) => {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-100 text-sm overflow-x-auto prose-table:w-full prose-td:border prose-th:border prose-td:border-slate-200 dark:prose-td:border-slate-700 prose-th:border-slate-200 dark:prose-th:border-slate-700 prose-th:bg-slate-100 dark:prose-th:bg-slate-800 prose-td:p-2 prose-th:p-2 prose-table:table-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      </div>
    );
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Floating Button */}
      <div className={`fixed right-4 md:right-6 z-[60] flex items-center justify-center transition-all duration-300 ${mobileNavStyle === 'bottom' ? 'bottom-24' : 'bottom-6'} md:bottom-6`}>
        {!isOpen && <div className="absolute inset-0 bg-purple-400 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-4 text-white rounded-full transition-all duration-300 flex items-center justify-center group ${isOpen ? 'bg-slate-700 hover:bg-slate-800 shadow-lg rotate-90' : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/50 hover:shadow-purple-500/80 opacity-90 hover:opacity-100'}`}
        >
          {isOpen ? <X size={24} className="transition-transform duration-300" /> : <img src="/revenuechat-icon.png" alt="RevenueChat AI" className="w-6 h-6 object-contain group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300 dark:invert" />}
        </button>
      </div>

      {/* Chat Panel */}
      <div 
        className={`fixed right-4 md:right-6 w-[360px] h-[550px] max-h-[70vh] md:max-h-[85vh] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'} ${mobileNavStyle === 'bottom' ? 'bottom-[110px]' : 'bottom-[88px]'} md:bottom-[88px]`}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <MessageSquare size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Revenue Insights AI</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Ask about your finances</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`p-3 rounded-2xl relative group ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700 rounded-tl-sm shadow-sm'}`}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <>
                    {formatMessage(msg.content)}
                    {msg.action && msg.action.type !== 'DOCUMENT_CREATED' && (
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 rounded-lg">
                        <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-2">
                          Action Required: {msg.action.type.replace('_', ' ')}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleExecuteAction(msg.id, msg.action!)}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-md transition-colors font-medium flex items-center justify-center gap-1"
                          >
                            <CheckCircle size={14} /> Confirm
                          </button>
                          <button
                            onClick={() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, action: undefined, content: m.content + '\n\n*Action Cancelled*' } : m))}
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs py-1.5 rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.action && msg.action.type === 'DOCUMENT_CREATED' && (
                      <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-900/50 rounded-lg flex gap-2">
                        <button
                          onClick={() => {
                            const { documentType, rawDoc } = msg.action!.payload;
                            navigate(documentType === 'Invoice' ? '/invoices/new' : '/quotes/new', { state: { [documentType.toLowerCase()]: rawDoc } });
                            setIsOpen(false);
                          }}
                          className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs py-2 rounded-md transition-colors font-medium text-center"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setSendModalConfig({ isOpen: true, documentId: msg.action!.payload.documentId, documentType: msg.action!.payload.documentType as any })}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 rounded-md transition-colors font-medium text-center"
                        >
                          Send
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      title="Copy message"
                    >
                      {copiedId === msg.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-tl-sm shadow-sm flex flex-col gap-2 min-w-[100px]">
                <div className="flex items-center gap-1.5 h-5">
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <div className="w-24 h-2 bg-slate-100 dark:bg-slate-700 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Prompts */}
        {messages.length === 1 && !isTyping && (
          <div className="px-4 pb-2 bg-slate-50/50 dark:bg-slate-900/50 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setInput(prompt)}
                className="text-left text-[11px] px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:border-purple-300 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl relative">
          
          {/* Autocomplete Popover */}
          {(input.startsWith('/') || input.includes('@')) && (
            <div className="absolute bottom-full left-4 mb-2 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-10 p-1">
              {input.startsWith('/') && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Commands</div>
                  {['/create', '/edit', '/client', '/quote', '/invoice', '/help'].filter(c => c.startsWith(input.toLowerCase())).map(cmd => (
                    <button key={cmd} onClick={() => setInput(cmd + ' ')} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
                      {cmd}
                    </button>
                  ))}
                </>
              )}
              {input.includes('@') && (
                <>
                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Clients</div>
                  {storeClients.filter(c => c.name.toLowerCase().includes(input.split('@')[1].toLowerCase())).map(client => (
                    <button key={client.localId} onClick={() => setInput(input.substring(0, input.lastIndexOf('@')) + '@' + client.name + ' ')} className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">
                      {client.name}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question, or type / for commands..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={isTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="p-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isTyping ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <img src="/revenuechat-icon.png" alt="RevenueChat AI" className="w-3 h-3 object-contain dark:invert opacity-70" /> AI-Powered · Privacy First (No PII sent)
            </p>
          </div>
        </div>
      </div>

      {/* Send Document Modal */}
      {sendModalConfig.isOpen && (
        <SendDocumentModal
          isOpen={sendModalConfig.isOpen}
          onClose={() => setSendModalConfig(prev => ({ ...prev, isOpen: false }))}
          documentId={sendModalConfig.documentId}
          documentType={sendModalConfig.documentType}
          amount="Unknown" // Amount is fetched internally by the modal
        />
      )}
    </>,
    document.body
  );
};
