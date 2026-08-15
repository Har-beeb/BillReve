import React from 'react';
import { SEO } from '../../components/SEO';
import { motion } from 'framer-motion';
import { Zap, ShieldCheck, Sparkles } from 'lucide-react';

const updates = [
  {
    version: 'v1.6.0',
    date: 'August 14, 2026',
    title: 'Smart Quote Looping & Minimum Counter Pricing',
    description: 'We have massively upgraded the way quotes are handled! Engage in continuous negotiations with your clients without ever needing to generate a new quote link. Plus, your Revenue AI just got smarter about your rules.',
    features: ['Quote Redrafting Loop', 'Minimum Counter Offer Pricing', 'Decline Context Reasons', 'RevenueChat Quote-Awareness Upgrades', 'UI/UX Polish for Desktop Onboarding'],
    icon: <Sparkles className="text-purple-500" size={24} />
  },
  {
    version: 'v1.5.0',
    date: 'August 8, 2026',
    title: 'Revenue AI Integration',
    description: 'We are thrilled to introduce Revenue AI, your personal financial assistant. BillReve now lets you create invoices, quotes, and answer client queries purely through conversation.',
    features: ['Conversational UI for Invoicing', 'AI-driven Terms & Notes Enhancement', 'Smart Autocomplete Commands'],
    icon: <Sparkles className="text-purple-500" size={24} />
  },
  {
    version: 'v1.2.0',
    date: 'August 3, 2026',
    title: 'Offline-First Architecture',
    description: 'Never lose your work again. BillReve now runs completely offline-first using IndexedDB, syncing your invoices to the cloud the moment you reconnect.',
    features: ['Instant Load Times', 'Background Cloud Sync Engine', 'Conflict Resolution System'],
    icon: <ShieldCheck className="text-emerald-500" size={24} />
  },
  {
    version: 'v1.0.0',
    date: 'July 28, 2026',
    title: 'The Foundation',
    description: 'BillReve officially launches to help freelancers and SMEs reclaim their time with seamless, modern invoicing tools.',
    features: ['Beautiful PDF Generation', 'Customizable Tax Settings', 'Client Management Dashboard'],
    icon: <Zap className="text-amber-500" size={24} />
  }
];

const Changelog: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <SEO title="Changelog" />
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-['Outfit'] font-black text-slate-900 dark:text-white mb-6">
          Changelog
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
          See what's new and what we've been working on to make BillReve the best invoicing platform for your business.
        </p>
      </div>

      <div className="space-y-12">
        {updates.map((update, index) => (
          <motion.div 
            key={update.version}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex flex-col md:flex-row gap-8 relative"
          >
            <div className="md:w-48 shrink-0">
              <div className="sticky top-24">
                <span className="inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-sm mb-2">
                  {update.version}
                </span>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{update.date}</p>
              </div>
            </div>
            
            <div className="flex-1 bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
                  {update.icon}
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{update.title}</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                {update.description}
              </p>
              <ul className="space-y-3">
                {update.features.map(feature => (
                  <li key={feature} className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Changelog;
