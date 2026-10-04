import React, { useState } from 'react';
import { Bot, Copy, Check, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { generateCfoReport } from '../../api/ai';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AICfoReportProps {
  metrics: {
    totalRevenue: number;
    outstandingBalance: number;
    totalTaxCollected: number;
  };
  invoices: any[]; // Kept for prop compatibility
  clients: any[];  // Kept for prop compatibility
}

export const AICfoReport: React.FC<AICfoReportProps> = ({ metrics }) => {
  const { businessProfile } = useAppStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportText, setReportText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      
      // Fetch compressed AI context from the server
      const { data: aiContext, error: rpcError } = await supabase.rpc('get_ai_context');
      
      if (rpcError) {
        console.error('Failed to fetch AI context:', rpcError);
        throw new Error('Failed to gather financial context. Please try again.');
      }

      const payload = {
        data: { aggregatedSummary: aiContext },
        businessProfile,
        metrics
      };

      const result = await generateCfoReport(payload);
      setReportText(result.text);
      setGeneratedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      toast.success('CFO Report generated!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to generate AI CFO report.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      toast.success('Report copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy. Please select and copy manually.');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden mb-6">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
            <Bot className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              AI CFO Report <Sparkles size={14} className="text-amber-400" />
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              AI-generated financial health & action report for your business
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {reportText && (
            <button
              onClick={handleCopy}
              title="Copy report"
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
          <button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-lg shadow-sm transition-all disabled:opacity-60"
          >
            {isGenerating ? (
              <><Loader2 size={14} className="animate-spin" /> Analysing...</>
            ) : reportText ? (
              <><RefreshCw size={14} /> Regenerate</>
            ) : (
              <><FileText size={14} /> Generate Report</>
            )}
          </button>
        </div>
      </div>

      {/* Empty / Loading State */}
      {!reportText && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/20 flex items-center justify-center mb-4">
            <Bot size={28} className="text-indigo-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">No report generated yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-xs">
            Click "Generate Report" to get a structured financial analysis of your business.
          </p>
        </div>
      )}

      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="animate-spin text-purple-500" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Analysing your financial data…</p>
        </div>
      )}

      {/* Report Output */}
      {reportText && !isGenerating && (
        <div className="p-6 md:p-8">
          {/* Timestamp only */}
          {generatedAt && (
            <div className="flex items-center justify-end mb-6">
              <span className="text-xs text-slate-400 dark:text-slate-500">Generated today at {generatedAt}</span>
            </div>
          )}

          {/* Rendered markdown with guaranteed custom component styling */}
          <div className="max-w-4xl mx-auto">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...props}) => (
                  <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white border-b-2 border-slate-900 dark:border-slate-100 pb-4 mb-8 mt-2 leading-tight tracking-tight" {...props} />
                ),
                h2: ({node, ...props}) => (
                  <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mt-14 mb-6 border-l-4 border-indigo-500 pl-4 bg-indigo-50/50 dark:bg-indigo-900/20 py-2 rounded-r-lg" {...props} />
                ),
                h3: ({node, ...props}) => (
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mt-8 mb-4" {...props} />
                ),
                p: ({node, ...props}) => (
                  <p className="text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-6" {...props} />
                ),
                ul: ({node, ...props}) => (
                  <ul className="list-disc pl-6 mb-8 space-y-3" {...props} />
                ),
                ol: ({node, ...props}) => (
                  <ol className="list-decimal pl-6 mb-8 space-y-3" {...props} />
                ),
                li: ({node, ...props}) => (
                  <li className="text-base text-slate-700 dark:text-slate-300 leading-relaxed pl-2" {...props} />
                ),
                strong: ({node, ...props}) => (
                  <strong className="font-bold text-slate-900 dark:text-white" {...props} />
                ),
                hr: ({node, ...props}) => (
                  <hr className="border-t-2 border-dashed border-slate-200 dark:border-slate-700 my-10" {...props} />
                ),
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-indigo-400 pl-6 py-4 my-8 bg-indigo-50 dark:bg-indigo-900/20 text-slate-700 dark:text-slate-300 italic rounded-r-xl" {...props} />
                ),
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-8 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-left border-collapse" {...props} />
                  </div>
                ),
                th: ({node, ...props}) => (
                  <th className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold py-4 px-5 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap" {...props} />
                ),
                td: ({node, ...props}) => (
                  <td className="py-4 px-5 border-b border-slate-100 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 align-middle" {...props} />
                ),
              }}
            >
              {reportText}
            </ReactMarkdown>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500 italic">
              AI-generated — please review before making financial decisions.
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied!' : 'Copy report'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
