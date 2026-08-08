import React from 'react';
import { Sparkles, FileText, Download, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const TEMPLATES = [
  {
    name: 'Freelance Design Invoice',
    industry: 'Design & Creative',
    color: 'bg-purple-100 dark:bg-purple-900/50',
    iconColor: 'text-purple-600'
  },
  {
    name: 'Consulting Retainer Quote',
    industry: 'Business Consulting',
    color: 'bg-emerald-100 dark:bg-emerald-900/50',
    iconColor: 'text-emerald-600'
  },
  {
    name: 'Software Development Bill',
    industry: 'Technology & IT',
    color: 'bg-blue-100 dark:bg-blue-900/50',
    iconColor: 'text-blue-600'
  },
  {
    name: 'Marketing Retainer Invoice',
    industry: 'Digital Marketing',
    color: 'bg-amber-100 dark:bg-amber-900/50',
    iconColor: 'text-amber-600'
  }
];

const Templates: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-16 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-sm font-bold mb-6">
          <Sparkles size={16} />
          <span>Automated by Revenue AI</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-['Outfit'] font-black text-slate-900 dark:text-white mb-6">
          Free Invoice Templates
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          Why download messy Word or Excel templates? BillReve generates beautiful, PDF-ready invoices instantly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="bg-slate-900 dark:bg-slate-800 rounded-3xl p-8 lg:p-12 flex flex-col justify-center border border-slate-800">
          <h2 className="text-3xl font-black text-white mb-6 font-['Outfit']">
            Stop filling in the blanks. Let AI do the heavy lifting.
          </h2>
          <ul className="space-y-4 mb-8">
            <li className="flex gap-3 text-slate-300">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
              <span>Automatically formats client details and addresses.</span>
            </li>
            <li className="flex gap-3 text-slate-300">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
              <span>Calculates taxes, subtotals, and totals instantly.</span>
            </li>
            <li className="flex gap-3 text-slate-300">
              <CheckCircle2 className="text-emerald-500 shrink-0" size={24} />
              <span>Generates professional terms and notes automatically.</span>
            </li>
          </ul>
          <div>
            <Link to="/register" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-lg shadow-purple-500/25">
              Generate Your First Invoice
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TEMPLATES.map((template, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col items-center text-center hover:border-purple-200 dark:hover:border-purple-800 transition-colors group cursor-pointer">
              <div className={`w-16 h-16 rounded-2xl ${template.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <FileText className={template.iconColor} size={28} />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{template.name}</h3>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-6">{template.industry}</p>
              
              <div className="mt-auto">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-400 group-hover:text-purple-600 transition-colors">
                  <Download size={16} /> Auto-Generate
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Templates;
