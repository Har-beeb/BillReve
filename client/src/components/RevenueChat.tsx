import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot, User } from 'lucide-react';
import { db } from '../db/db';
import { chatWithRevenue } from '../api/ai';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

export const RevenueChat: React.FC = () => {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMsg, timestamp: new Date() }]);
    setIsTyping(true);

    try {
      // 1. Fetch data from DB
      const rawInvoices = await db.invoices.toArray();
      const rawQuotes = await db.quotes.toArray();
      const rawClients = await db.clients.toArray();

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
      <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800 prose-pre:text-slate-100">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    );
  };

  if (!mounted) return null;

  return createPortal(
    <>
      {/* Floating Button */}
      <div className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-[60] flex items-center justify-center transition-all duration-300">
        {!isOpen && <div className="absolute inset-0 bg-purple-400 rounded-full animate-ping opacity-20" style={{ animationDuration: '3s' }}></div>}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-4 text-white rounded-full transition-all duration-300 flex items-center justify-center group ${isOpen ? 'bg-slate-700 hover:bg-slate-800 shadow-lg rotate-90' : 'bg-purple-600 hover:bg-purple-500 shadow-[0_0_15px_var(--color-primary)] hover:shadow-[0_0_25px_var(--color-primary)] opacity-90 hover:opacity-100'}`}
        >
          {isOpen ? <X size={24} className="transition-transform duration-300" /> : <Sparkles size={24} className="group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />}
        </button>
      </div>

      {/* Chat Panel */}
      <div 
        className={`fixed bottom-[110px] md:bottom-[88px] right-4 md:right-6 w-[360px] h-[550px] max-h-[70vh] md:max-h-[85vh] max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-all duration-300 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'}`}
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
              <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-purple-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700 rounded-tl-sm shadow-sm'}`}>
                {msg.role === 'user' ? <p className="text-sm">{msg.content}</p> : formatMessage(msg.content)}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-8 h-8 shrink-0 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Bot size={16} />
              </div>
              <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700 rounded-tl-sm shadow-sm flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 rounded-b-2xl">
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
