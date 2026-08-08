import React from 'react';
import { ArrowRight, BookOpen, PenTool, LayoutTemplate } from 'lucide-react';
import { Link } from 'react-router-dom';

const GUIDES = [
  {
    title: 'How to Write a Professional Invoice',
    description: 'Learn the essential elements every invoice needs to ensure you get paid on time, every time.',
    icon: <PenTool className="text-purple-500" size={24} />,
    color: 'bg-purple-50 dark:bg-purple-900/20',
    borderColor: 'border-purple-200 dark:border-purple-800'
  },
  {
    title: 'The Freelancer\'s Guide to Taxes',
    description: 'A comprehensive overview of managing withholding taxes, VAT, and end-of-year reporting.',
    icon: <BookOpen className="text-emerald-500" size={24} />,
    color: 'bg-emerald-50 dark:bg-emerald-900/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800'
  },
  {
    title: 'Structuring Project Quotes',
    description: 'Stop underpricing. Discover how to structure your quotes to communicate value and win better clients.',
    icon: <LayoutTemplate className="text-amber-500" size={24} />,
    color: 'bg-amber-50 dark:bg-amber-900/20',
    borderColor: 'border-amber-200 dark:border-amber-800'
  }
];

const Guides: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-['Outfit'] font-black text-slate-900 dark:text-white mb-6">
          Invoicing Guides
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Master the art of freelance billing, client management, and financial organization with our curated guides and best practices.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {GUIDES.map((guide, i) => (
          <div key={i} className={`rounded-3xl border ${guide.borderColor} bg-white dark:bg-slate-900 overflow-hidden hover:shadow-xl transition-all duration-300 group flex flex-col`}>
            <div className={`h-32 ${guide.color} flex items-center justify-center`}>
              <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300">
                {guide.icon}
              </div>
            </div>
            <div className="p-8 flex-1 flex flex-col">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{guide.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8 flex-1 leading-relaxed">
                {guide.description}
              </p>
              <button className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                Read Guide <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-24 bg-slate-900 dark:bg-slate-800 rounded-3xl p-12 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
        <h2 className="text-3xl font-black text-white mb-6 font-['Outfit']">Put this knowledge into practice</h2>
        <p className="text-slate-300 mb-8 max-w-xl mx-auto">
          Start generating professional invoices in seconds using our offline-first platform and Revenue AI.
        </p>
        <Link to="/register" className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-lg hover:shadow-purple-500/25">
          Get Started for Free
        </Link>
      </div>
    </div>
  );
};

export default Guides;
