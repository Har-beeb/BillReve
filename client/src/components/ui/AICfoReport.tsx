import React, { useState } from 'react';
import { Bot, FileText, Loader2, Sparkles } from 'lucide-react';
import { generateCfoReport } from '../../api/ai';
import { useAppStore } from '../../store/useAppStore';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

interface AICfoReportProps {
  metrics: {
    totalRevenue: number;
    outstandingBalance: number;
    totalTaxCollected: number;
  };
  invoices: any[];
  clients: any[];
}

export const AICfoReport: React.FC<AICfoReportProps> = ({ metrics, invoices, clients }) => {
  const { businessProfile } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      
      const payload = {
        data: {
          invoices: invoices.map(i => ({ 
            id: i.localId, 
            amount: i.total, 
            status: i.status, 
            clientId: i.clientId,
            date: i.issuedAt
          })),
          clients: clients.map(c => ({
            id: c.localId,
            name: c.name
          }))
        },
        businessProfile,
        metrics
      };

      const result = await generateCfoReport(payload);
      setReportText(result.text);
      toast.success('CFO Report generated successfully!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to generate AI CFO report.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Bot className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              AI CFO Insights <Sparkles size={16} className="text-amber-500" />
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Generate a personalized financial health and action report for your business.
            </p>
          </div>
        </div>
        
        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-lg shadow-sm transition-all flex items-center gap-2 justify-center disabled:opacity-70"
        >
          {isGenerating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Analyzing Data...
            </>
          ) : (
            <>
              <FileText size={16} />
              {reportText ? 'Regenerate Report' : 'Generate Report'}
            </>
          )}
        </button>
      </div>

      {reportText && (
        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
          <div className="prose prose-slate dark:prose-invert max-w-none prose-h2:text-xl prose-h2:mb-4 prose-h3:text-lg prose-p:text-sm prose-li:text-sm">
            <ReactMarkdown>{reportText}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};
