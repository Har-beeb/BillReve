import React, { useState } from 'react';
import { Search, ChevronDown, MessageCircle, FileText, Settings, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQS = [
  {
    category: 'Getting Started',
    icon: <Zap size={20} className="text-amber-500" />,
    items: [
      { q: 'How does offline mode work?', a: 'BillReve uses IndexedDB in your browser to store your data locally. When you lose connection, you can keep working normally. Once you reconnect, our Sync Engine automatically pushes your changes to the cloud securely.' },
      { q: 'Is my data secure?', a: 'Absolutely. We use enterprise-grade encryption for all data in transit and at rest. Your local data is stored within your browser\'s secure sandbox.' }
    ]
  },
  {
    category: 'Revenue AI',
    icon: <MessageCircle size={20} className="text-purple-500" />,
    items: [
      { q: 'What can Revenue AI do?', a: 'Revenue AI is a conversational assistant that can draft invoices, write quotes, answer questions about your outstanding balances, and format professional terms and notes for your clients.' },
      { q: 'How do I generate an invoice with AI?', a: 'Just open the AI chat (the sparkle icon in the corner) and type something like "Create an invoice for John Doe for $500 for web design". The AI will guide you through any missing details and draft it for you.' }
    ]
  },
  {
    category: 'Invoicing & Quotes',
    icon: <FileText size={20} className="text-blue-500" />,
    items: [
      { q: 'Can I send invoices via WhatsApp?', a: 'Yes! When you click Send on any document, you have the option to send via Email (directly from our servers) or via WhatsApp, which will open your WhatsApp app with a pre-formatted message and a secure public link to the invoice.' },
      { q: 'How do clients pay?', a: 'Clients receive a secure, public link to view their invoice online. (Online payments integration is coming soon in v2.0).' }
    ]
  },
  {
    category: 'Account & Settings',
    icon: <Settings size={20} className="text-slate-500" />,
    items: [
      { q: 'How do I customize my invoice template?', a: 'Go to Settings > Invoice Preferences. You can change your brand color, typography, upload your logo, and add your default bank account details.' },
      { q: 'Can I change the default currency?', a: 'Yes, in your Profile settings you can set your default currency. The AI will enforce this currency for all automatically generated documents.' }
    ]
  }
];

const HelpCenter: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openItems, setOpenItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-['Outfit'] font-black text-slate-900 dark:text-white mb-6">
          Help Center
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10">
          Everything you need to know about getting the most out of BillReve.
        </p>

        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all outline-none"
          />
        </div>
      </div>

      <div className="space-y-12">
        {FAQS.map(category => {
          const filteredItems = category.items.filter(item => 
            item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
            item.a.toLowerCase().includes(searchQuery.toLowerCase())
          );

          if (filteredItems.length === 0) return null;

          return (
            <div key={category.category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  {category.icon}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{category.category}</h2>
              </div>
              <div className="space-y-4">
                {filteredItems.map((item, i) => {
                  const id = `${category.category}-${i}`;
                  const isOpen = openItems.has(id);
                  return (
                    <div 
                      key={id} 
                      className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden hover:border-purple-200 dark:hover:border-purple-800/50 transition-colors"
                    >
                      <button
                        onClick={() => toggleItem(id)}
                        className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                      >
                        <span className="font-semibold text-slate-900 dark:text-white pr-4">{item.q}</span>
                        <ChevronDown 
                          className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? 'rotate-180 text-purple-500' : ''}`} 
                        />
                      </button>
                      <AnimatePresence>
                        {isOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-6 pb-5 pt-0 text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 mt-2 pt-4">
                              {item.a}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HelpCenter;
