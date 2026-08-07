import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Wand2, UploadCloud, FileText, Loader2, Sparkles } from 'lucide-react';
import { generateAiQuote } from '../api/ai';
import { useAppStore } from '../store/useAppStore';
import { useNavigate } from 'react-router-dom';

interface AiDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (documentData: any) => void;
  defaultTab?: 'text' | 'document';
  documentType?: 'QUOTE' | 'INVOICE';
}

export const AiDraftModal: React.FC<AiDraftModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  documentType = 'QUOTE',
  defaultTab = 'text'
}) => {
  const navigate = useNavigate();
  const { isProUser, businessProfile } = useAppStore();
  const [activeTab, setActiveTab] = useState<'text' | 'document'>(defaultTab);
  const [textInput, setTextInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerate = async () => {
    setError(null);
    setIsLoading(true);

    try {
      let payload: { text?: string; documents?: { mimeType: string; data: string }[] } = {};
      
      if (activeTab === 'text') {
        if (!textInput.trim()) throw new Error(`Please enter some notes to generate a ${documentType.toLowerCase()}.`);
        payload.text = textInput;
      } else {
        if (!file) throw new Error(`Please upload a document to generate a ${documentType.toLowerCase()}.`);
        const base64 = await fileToBase64(file);
        payload.documents = [{
          mimeType: file.type,
          data: base64
        }];
      }

      // @ts-ignore - passing documentType to API if updated
      const generatedData = await generateAiQuote({ ...payload, documentType, businessProfile });
      onSuccess(generatedData);
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to generate ${documentType.toLowerCase()}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-lg border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 dark:from-slate-800/50 dark:to-slate-800/50">
          <div className="flex items-center gap-2">
            <div className={`p-2 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded-lg transition-all ${isLoading ? 'animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]' : ''}`}>
              <Sparkles size={20} className={isLoading ? 'animate-spin-slow' : ''} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Draft {documentType === 'INVOICE' ? 'Invoice' : 'Quote'} with AI</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Instantly generate a {documentType.toLowerCase()} from your notes or files.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X size={20} />
          </button>
        </div>

        {!isProUser ? (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white mb-4 shadow-lg shadow-purple-500/30">
              <Sparkles size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Unlock AI Drafting</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-8">
              Upgrade to BillReve Pro to instantly generate invoices and quotes from raw text or uploaded documents. Save hours of manual entry!
            </p>
            <div className="flex gap-4">
              <button 
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Maybe Later
              </button>
              <button 
                onClick={() => { onClose(); navigate('/upgrade'); }}
                className="px-6 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors shadow-md"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-4 gap-6">
          <button
            onClick={() => setActiveTab('text')}
            className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'text' ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          >
            <FileText size={16} /> Text & Notes
          </button>
          <button
            onClick={() => setActiveTab('document')}
            className={`pb-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'document' ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'}`}
          >
            <UploadCloud size={16} /> Document / Receipt
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30">
              {error}
            </div>
          )}

          {activeTab === 'text' ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">Or paste your unstructured text here to let AI extract the line items.</p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`e.g. "Client needs a landing page ($500), 3 logo concepts ($150 each), and a rush fee of $100. Tax is 5%."`}
                className="w-full h-48 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-sm text-slate-700 dark:text-slate-300 resize-none"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Upload File</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-slate-300 dark:border-slate-700 hover:border-purple-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  className="hidden" 
                  accept="image/*,application/pdf"
                />
                <UploadCloud size={32} className={file ? 'text-purple-500' : 'text-slate-400'} />
                <p className="mt-4 font-medium text-slate-700 dark:text-slate-300 text-sm">
                  {file ? file.name : 'Click to upload a document or image'}
                </p>
                {!file && (
                  <p className="mt-1 text-xs text-slate-500 text-center max-w-[250px]">
                    Supports PDF, JPG, and PNG. We'll extract the line items and totals.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 rounded-b-xl">
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={isLoading || (activeTab === 'text' ? !textInput.trim() : !file)}
            className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? (
              <><Loader2 size={18} className="animate-spin" /> Generating {documentType === 'INVOICE' ? 'Invoice' : 'Quote'}...</>
            ) : (
              <><Wand2 size={18} /> Generate {documentType === 'INVOICE' ? 'Invoice' : 'Quote'}</>
            )}
          </button>
        </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};
