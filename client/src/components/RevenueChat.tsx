import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, User, Copy, Check } from 'lucide-react';
import { db } from '../db/db';
import { chatWithRevenue } from '../api/ai';
import { useAppStore } from '../store/useAppStore';
import { ProFeature } from './ui/ProFeature';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export const RevenueChat: React.FC = () => {
  const { isProUser, mobileNavStyle } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'ai',
      content: 'Hi! I am your Revenue AI. Ask me anything about your invoices, quotes, or clients.',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const SUGGESTED_PROMPTS = [
    "Who owes me the most money?",
    "Draft a polite reminder for overdue invoices",
    "What is my total revenue this month?",
    "Who is my best client?"
  ];

  // Optional: render nothing during SSR if we're worried about document being undefined,
  // but since this is a pure CSR React app, document.body is always available.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
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
    
    if (!navigator.onLine) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: 'You must be online to use the AI Revenue Chat feature.', timestamp: new Date() }]);
      return;
    }

    const userMsg = input.trim();
    setInput('');
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
      const result = await chatWithRevenue({
        prompt: userMsg,
        data: { invoices, quotes, clients }
      });

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: result.text || 'I could not process that.', timestamp: new Date() }]);
    } catch (err: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: `Error: ${err.message || 'Failed to connect to AI.'}`, timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const formatMessage = (text: string) => {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-100 text-sm">
        <ReactMarkdown>{text}</ReactMarkdown>
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
          {isOpen ? <X size={24} className="transition-transform duration-300" /> : <Sparkles size={24} className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />}
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
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
          <ProFeature isProUser={isProUser}>
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your revenue..."
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
          </ProFeature>
          <div className="text-center mt-2">
            <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
              <Sparkles size={10} /> AI-Powered · Privacy First (No PII sent)
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};
