import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Plus, Download, RefreshCw, FileText } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Badge, ProFeature } from '../components/ui';
import { formatMoney, formatDate } from '../utils/formatters';
import { Pagination } from '../components/Pagination';
import { PreviewPanel } from '../components/PreviewPanel';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import type { Quote } from '../types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AiDraftModal } from '../components/AiDraftModal';
import { SendDocumentModal } from '../components/SendDocumentModal';
import { SplitButton, ActionMenu, LongPressable, EmptyState } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { useSelection } from '../hooks/useSelection';
import { usePagination } from '../hooks/usePagination';
import { generateDocumentPdf } from '../utils/pdfGenerator';

/**
 * Quotes Component
 * Displays a list of all quotes, summary metrics, and a side panel
 * for quick previewing and conversion to invoices.
 */

const Quotes: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isProUser = useAppStore((state) => state.isProUser);
  const businessProfile = useAppStore((state) => state.businessProfile);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<string | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalDefaultTab, setAiModalDefaultTab] = useState<'text' | 'document'>('text');
  
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [quoteToSend, setQuoteToSend] = useState<Quote | null>(null);
  
  const quotes = useLiveQuery(() => db.quotes.toArray()) || [];
  const clients = useLiveQuery(() => db.clients.toArray()) || [];
  const [activeCard, setActiveCard] = useState(0);
  const carouselRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const previewId = searchParams.get('preview');
    if (previewId && quotes.length > 0) {
      const q = quotes.find(q => q.localId === previewId);
      if (q) {
        setSelectedQuote(q);
        // Clean up URL without triggering navigation
        searchParams.delete('preview');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, quotes, setSearchParams]);

  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollLeft = carouselRef.current.scrollLeft;
      const width = carouselRef.current.children[0].clientWidth;
      const index = Math.round(scrollLeft / width);
      setActiveCard(index);
    }
  };

  const scrollToCard = (index: number) => {
    if (carouselRef.current) {
      const width = carouselRef.current.children[0].clientWidth;
      carouselRef.current.scrollTo({
        left: index * (width + 16),
        behavior: 'smooth'
      });
    }
  };



  const filteredQuotes = quotes.filter(q => 
    (filter === 'All' || q.status === filter.toUpperCase() || (filter === 'Declined' && (q.status as any) === 'REJECTED')) &&
    (search === '' || (q.quoteNumber && q.quoteNumber.toLowerCase().includes(search.toLowerCase())) || q.clientId.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedQuotes } = usePagination(filteredQuotes, 10);
  const { selectedIds, toggleSelect, toggleSelectAll, setSelectedIds } = useSelection(paginatedQuotes, (q) => q.localId);

  const handleDownloadPdf = async (quote: Quote) => {
    try {
      const client = clients.find(c => c.localId === quote.clientId);
      await generateDocumentPdf(quote, client, businessProfile, 'QUOTE', true);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      alert('Failed to generate PDF');
    }
  };

  const handleDeleteQuote = async (id: string) => {
    await db.quotes.delete(id);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'DELETE',
      entity: 'QUOTE',
      payload: { local_id: id },
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    if (selectedQuote?.localId === id) setSelectedQuote(null);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await db.quotes.delete(id);
      await db.syncQueue.add({
        id: uuidv4(),
        action: 'DELETE',
        entity: 'QUOTE',
        payload: { local_id: id },
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
    setSelectedIds(new Set());
  };

  const handleBulkExportPdf = async () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one quote to export.');
      return;
    }
    for (const id of selectedIds) {
      const quote = quotes.find(q => q.localId === id);
      if (quote) {
        await handleDownloadPdf(quote);
      }
    }
  };

  const handleBulkExportCsv = () => {
    if (selectedIds.size === 0) {
      alert('Please select at least one quote to export.');
      return;
    }
    const selectedQuotes = quotes.filter(q => selectedIds.has(q.localId));
    
    import('../utils/csvGenerator').then(({ exportToCsv }) => {
      const headers = ['Quote Number', 'Client', 'Description', 'Date Issued', 'Status', 'Subtotal', 'Tax', 'Total'];
      const rows = selectedQuotes.map(quote => {
        const client = clients.find(c => c.localId === quote.clientId);
        const taxAmount = quote.taxes?.reduce((sum, t) => sum + (t.isDeduction ? -t.amount : t.amount), 0) || 0;
        return [
          quote.quoteNumber || quote.localId.slice(0, 8),
          client?.name || quote.clientId,
          quote.description || '',
          new Date(quote.issuedAt || quote.createdAt).toLocaleDateString(),
          quote.status,
          quote.subtotal,
          taxAmount,
          quote.total
        ];
      });
      exportToCsv(`quotes-export-${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    });
  };

  const handleConvertSelected = () => {
    if (selectedIds.size !== 1) {
      alert('Please select exactly one quote to convert.');
      return;
    }
    const id = Array.from(selectedIds)[0];
    const quote = quotes.find(q => q.localId === id);
    if (quote) {
      const { localId, quoteNumber, status, createdAt, updatedAt, syncStatus, ...rest } = quote;
      navigate('/invoices/new', { state: { invoice: rest } });
    }
  };

  const handleUpdateStatus = async (quote: Quote, status: 'ACCEPTED' | 'DECLINED') => {
    const updated = { ...quote, status, updatedAt: new Date().toISOString() };
    await db.quotes.put(updated);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'QUOTE',
      payload: updated,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  };

  const handleRespondToCounter = async (quote: Quote, accept: boolean) => {
    const updated = accept 
      ? { 
          ...quote, 
          status: 'ACCEPTED' as const, 
          total: quote.counterAmount || quote.total,
          updatedAt: new Date().toISOString() 
        } 
      : { 
          ...quote, 
          status: 'DECLINED' as const, 
          updatedAt: new Date().toISOString() 
        };
    
    await db.quotes.put(updated);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'QUOTE',
      payload: updated,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  };

  const handleAiQuoteSuccess = (generatedQuote: any) => {
    navigate('/quotes/new', { state: { quote: generatedQuote } });
  };

  return (
    <div className="flex flex-col gap-6 relative animate-fade-in-up">
      <AiDraftModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
        onSuccess={handleAiQuoteSuccess}
        defaultTab={aiModalDefaultTab}
      />

      <SendDocumentModal
        isOpen={sendModalOpen}
        onClose={() => { setSendModalOpen(false); setQuoteToSend(null); }}
        documentId={quoteToSend?.localId || ''}
        clientEmail={clients.find(c => c.localId === quoteToSend?.clientId)?.email || ''}
        documentType="Quote"
        amount={quoteToSend ? formatMoney(quoteToSend.total, quoteToSend.currency) : ''}
      />

      {/* Sticky Action Bar (Desktop only, mobile has FAB) */}
      <div className="hidden md:flex sticky top-16 z-10 bg-slate-50 dark:bg-slate-900 pt-4 pb-4 -mt-4 border-b border-slate-200 dark:border-slate-800 flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 pb-2 md:pb-0">
          <SplitButton
            mainLabel={<><Plus size={18} /><span>New Quote</span></>}
            onMainClick={() => navigate('/quotes/new')}
            options={[
              { label: 'Create Manually', onClick: () => navigate('/quotes/new') },
              { label: 'Draft with AI', onClick: () => { setAiModalDefaultTab('text'); setIsAiModalOpen(true); } }
            ]}
          />
          <button 
            onClick={handleConvertSelected}
            disabled={selectedIds.size !== 1}
            className={`flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedIds.size !== 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <RefreshCw size={18} />
            <span>Convert</span>
          </button>
          <button 
            onClick={handleBulkExportPdf}
            disabled={selectedIds.size === 0}
            className={`flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
            <Download size={18} />
            <span>Export PDF</span>
          </button>
          <ProFeature isProUser={isProUser} className="inline-block">
            <button 
              onClick={handleBulkExportCsv}
              disabled={selectedIds.size === 0}
              className={`flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <Download size={18} />
              <span>Export CSV</span>
            </button>
          </ProFeature>
        </div>
      </div>

      {/* Mobile Sticky Search Bar and Inline Actions */}
      <div className="md:hidden sticky top-16 z-10 bg-slate-50 dark:bg-slate-900 pt-4 pb-4 -mt-4 border-b border-slate-200 dark:border-slate-800 flex gap-2">
         <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="flex-shrink-0 flex items-center">
          <SplitButton
            mainLabel={<Plus size={18} />}
            onMainClick={() => navigate('/quotes/new')}
            options={[
              { label: 'Create Manually', onClick: () => navigate('/quotes/new') },
              { label: 'Draft with AI', onClick: () => { setAiModalDefaultTab('text'); setIsAiModalOpen(true); } }
            ]}
          />
        </div>

        <button 
          onClick={handleConvertSelected}
          disabled={selectedIds.size !== 1}
          className={`flex-shrink-0 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-10 h-10 rounded-lg transition-colors text-slate-600 dark:text-slate-400 ${selectedIds.size !== 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
          <RefreshCw size={18} />
        </button>
        <ActionMenu 
          items={[
            { label: 'Export PDF', onClick: handleBulkExportPdf },
            ...(isProUser ? [{ label: 'Export CSV', onClick: handleBulkExportCsv }] : [])
          ]}
        />
      </div>

      {/* Summary Cards (Swipeable on Mobile) */}
      <div className="relative">
        <div 
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar md:grid md:grid-cols-3 gap-4 pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0"
        >
          <Card className="p-4 flex-shrink-0 w-[85vw] sm:w-[300px] md:w-auto snap-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
                <FileText size={16} />
                <span className="font-semibold text-sm">Total Quotes</span>
              </div>
              <span className="text-xl font-bold">{quotes.length} quotes</span>
            </div>
          </Card>
          
          <Card className="p-4 flex-shrink-0 w-[85vw] sm:w-[300px] md:w-auto snap-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <FileText size={16} />
                <span className="font-semibold text-sm">Accepted Quotes</span>
              </div>
              <span className="text-xl font-bold">
                {quotes.filter(q => q.status === 'ACCEPTED').length} quotes ({formatMoney(quotes.filter(q => q.status === 'ACCEPTED').reduce((sum, q) => sum + q.total, 0), 'NGN')})
              </span>
            </div>
          </Card>

          <ProFeature isProUser={isProUser} className="flex-shrink-0 w-[85vw] sm:w-[300px] md:w-auto snap-center">
            <Card className="p-4 border-red-100 dark:border-red-900/30 w-full h-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <FileText size={16} />
                  <span className="font-semibold text-sm">Declined Quotes</span>
                </div>
                <span className="text-xl font-bold">
                  {quotes.filter(q => q.status === 'DECLINED').length} quotes ({formatMoney(quotes.filter(q => q.status === 'DECLINED').reduce((sum, q) => sum + q.total, 0), 'NGN')})
                </span>
              </div>
            </Card>
          </ProFeature>
        </div>
        
        {/* Mobile Carousel Indicators */}
        <div className="md:hidden flex justify-center gap-2 mt-2">
          {[0, 1, 2].map((idx) => (
            <button 
              key={idx} 
              onClick={() => scrollToCard(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${activeCard === idx ? 'bg-purple-600 dark:bg-purple-400 w-3' : 'bg-slate-300 dark:bg-slate-700'}`}
              aria-label={`Go to summary card ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Filters & Bulk Actions */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Mobile Filter Dropdown */}
          <div className="md:hidden w-full">
            <select 
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm py-2 px-3 rounded-lg appearance-none"
            >
              {['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Countered'].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Desktop Filter Tabs */}
          <div className="hidden md:flex gap-1">
            {['All', 'Draft', 'Sent', 'Accepted', 'Declined', 'Countered'].map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  filter === f ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-3 px-2 border-l border-slate-200 dark:border-slate-700 ml-2 md:ml-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={paginatedQuotes.length > 0 && selectedIds.size === paginatedQuotes.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm font-medium hidden md:inline">Select All</span>
          </label>
          {selectedIds.size > 0 && (
            <div className="ml-2 flex items-center">
              <ActionMenu 
                items={[
                  { label: 'Delete Selected', onClick: () => setBulkDeleteModalOpen(true), variant: 'danger' }
                ]} 
              />
            </div>
          )}
        </div>
      </div>

      {/* Quote List (More compact) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="hidden md:grid grid-cols-12 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-t-xl">
          <div className="col-span-1 flex items-center">
             <input 
               type="checkbox" 
               checked={paginatedQuotes.length > 0 && selectedIds.size === paginatedQuotes.length}
               onChange={toggleSelectAll}
               className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
             />
          </div>
          <div className="col-span-4">Client & Quote</div>
          <div className="col-span-3">Description & Date</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right pr-8">Amount</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedQuotes.map((quote, index) => {
            return (
              <LongPressable 
                key={quote.localId} 
                onLongPress={() => toggleSelect(quote.localId)}
                onClick={() => setSelectedQuote(quote)}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`group px-6 md:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm block cursor-pointer animate-fade-in-up ${selectedIds.has(quote.localId) ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
              >
                {/* --- MOBILE VIEW --- */}
                <div className="flex md:hidden gap-3 items-start py-4">
                  <div className="flex-shrink-0 pt-1">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(quote.localId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(quote.localId); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                        {quote.quoteNumber || quote.localId.slice(0, 8)}
                      </div>
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                         {formatMoney(quote.total, quote.currency)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-slate-600 dark:text-slate-400 font-medium truncate pr-4">
                        {clients.find(c => c.localId === quote.clientId)?.name || quote.clientId}
                      </div>
                      <div>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <Badge variant={quote.status.toLowerCase() as any}>{quote.status}</Badge>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-slate-500 text-xs">{formatDate(quote.issuedAt)}</div>
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu items={[
                          { label: 'Download PDF', onClick: () => handleDownloadPdf(quote) },
                          ...(quote.status === 'DRAFT' ? [{ label: 'Edit', onClick: () => navigate('/quotes/new', { state: { quote } }) }] : []),
                          ...((quote.status === 'SENT' || quote.status === 'DRAFT') ? [
                            { label: 'Mark as Accepted', onClick: () => handleUpdateStatus(quote, 'ACCEPTED') },
                            { label: 'Mark as Declined', onClick: () => handleUpdateStatus(quote, 'DECLINED') }
                          ] : []),
                          ...(quote.status === 'COUNTERED' ? [
                            { label: 'Accept Counter', onClick: () => handleRespondToCounter(quote, true) },
                            { label: 'Decline Counter', onClick: () => handleRespondToCounter(quote, false) }
                          ] : []),
                          { label: 'Copy Link', onClick: () => {
                            navigator.clipboard.writeText(`${window.location.origin}/quote/${quote.localId}`);
                            alert('Link copied to clipboard');
                          } },
                          ...((quote.status === 'SENT' || quote.status === 'ACCEPTED') ? [{ label: 'Convert to Invoice', onClick: () => {
                            const { localId, quoteNumber, status, createdAt, updatedAt, syncStatus, ...rest } = quote;
                            navigate('/invoices/new', { state: { invoice: rest } });
                          } }] : []),
                          { label: 'Send / Share', onClick: () => { setQuoteToSend(quote); setSendModalOpen(true); } },
                          { label: 'Delete', onClick: () => { setQuoteToDelete(quote.localId); setDeleteModalOpen(true); }, variant: 'danger' }
                        ]} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* --- DESKTOP VIEW --- */}
                <div className="hidden md:grid grid-cols-12 items-center w-full py-4">
                  <div className="col-span-1 flex items-center">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(quote.localId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(quote.localId); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="col-span-4 flex flex-col justify-center">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors truncate pr-4">
                      {clients.find(c => c.localId === quote.clientId)?.name || quote.clientId}
                    </div>
                    <div className="text-slate-500 text-xs font-medium mt-0.5">
                      {quote.quoteNumber || quote.localId.slice(0, 8)}
                    </div>
                  </div>
                  
                  <div className="col-span-3 flex flex-col justify-center">
                    <div className="text-slate-600 dark:text-slate-300 text-sm truncate pr-4">
                      {quote.description || '—'}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      Issued {quote.issuedAt ? new Date(quote.issuedAt).toLocaleDateString() : 'Draft'}
                    </div>
                  </div>
                  
                  <div className="col-span-2 flex items-center">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Badge variant={quote.status.toLowerCase() as any}>{quote.status}</Badge>
                  </div>

                  <div className="col-span-2 flex items-center justify-end font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                     {formatMoney(quote.total, quote.currency)}
                     <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                       <ActionMenu items={[
                         { label: 'Download PDF', onClick: () => handleDownloadPdf(quote) },
                         ...(quote.status === 'DRAFT' ? [{ label: 'Edit', onClick: () => navigate('/quotes/new', { state: { quote } }) }] : []),
                         ...((quote.status === 'SENT' || quote.status === 'DRAFT') ? [
                           { label: 'Mark as Accepted', onClick: () => handleUpdateStatus(quote, 'ACCEPTED') },
                           { label: 'Mark as Declined', onClick: () => handleUpdateStatus(quote, 'DECLINED') }
                         ] : []),
                         ...(quote.status === 'COUNTERED' ? [
                           { label: 'Accept Counter', onClick: () => handleRespondToCounter(quote, true) },
                           { label: 'Decline Counter', onClick: () => handleRespondToCounter(quote, false) }
                         ] : []),
                         { label: 'Copy Link', onClick: () => {
                           navigator.clipboard.writeText(`${window.location.origin}/quote/${quote.localId}`);
                           alert('Link copied to clipboard');
                         } },
                         ...((quote.status === 'SENT' || quote.status === 'ACCEPTED') ? [{ label: 'Convert to Invoice', onClick: () => {
                            const { localId, quoteNumber, status, createdAt, updatedAt, syncStatus, ...rest } = quote;
                            navigate('/invoices/new', { state: { invoice: rest } });
                         } }] : []),
                         { label: 'Send / Share', onClick: () => { setQuoteToSend(quote); setSendModalOpen(true); } },
                         { label: 'Delete', onClick: () => { setQuoteToDelete(quote.localId); setDeleteModalOpen(true); }, variant: 'danger' }
                       ]} />
                     </div>
                  </div>
                </div>
              </LongPressable>
          )})}
          
          {paginatedQuotes.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={FileText}
                title="No quotes found"
                description={filter === 'All' ? "You haven't created any quotes yet. Send a quote to win your next client." : `No quotes match the "${filter}" filter.`}
                actionLabel={filter === 'All' ? "Create Quote" : undefined}
                onAction={filter === 'All' ? () => navigate('/quotes/new') : undefined}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Floating Action Button */}
      {createPortal(
        <button 
          onClick={() => navigate('/quotes/new')}
          className="md:hidden fixed bottom-24 right-4 z-50 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 hover:scale-110 active:scale-95 transition-all duration-300"
        >
          <Plus size={24} />
        </button>,
        document.body
      )}
      
      <Pagination 
        currentPage={currentPage} 
        totalPages={totalPages} 
        onPageChange={setCurrentPage} 
      />

      <PreviewPanel 
        isOpen={selectedQuote !== null} 
        onClose={() => setSelectedQuote(null)}
        title="Quote Details"
        actions={
          selectedQuote && (
            <ActionMenu 
              items={[
                { label: 'Download PDF', onClick: () => handleDownloadPdf(selectedQuote) },
                ...(selectedQuote.status === 'DRAFT' ? [{ label: 'Edit Quote', onClick: () => { navigate('/quotes/new', { state: { quote: selectedQuote } }); setSelectedQuote(null); } }] : []),
                ...((selectedQuote.status === 'SENT' || selectedQuote.status === 'ACCEPTED') ? [{ label: 'Convert to Invoice', onClick: () => { 
                   const { localId, quoteNumber, status, createdAt, updatedAt, syncStatus, ...rest } = selectedQuote;
                   navigate('/invoices/new', { state: { invoice: rest } }); 
                   setSelectedQuote(null); 
                } }] : []),
                ...((selectedQuote.status === 'SENT' || selectedQuote.status === 'DRAFT') ? [
                  { label: 'Mark as Accepted', onClick: () => handleUpdateStatus(selectedQuote, 'ACCEPTED') },
                  { label: 'Mark as Declined', onClick: () => handleUpdateStatus(selectedQuote, 'DECLINED') }
                ] : []),
                ...(selectedQuote.status === 'COUNTERED' ? [
                  { label: 'Accept Counter', onClick: () => handleRespondToCounter(selectedQuote, true) },
                  { label: 'Decline Counter', onClick: () => handleRespondToCounter(selectedQuote, false) }
                ] : []),
                { label: 'Copy Link', onClick: () => {
                  navigator.clipboard.writeText(`${window.location.origin}/quote/${selectedQuote.localId}`);
                  alert('Link copied to clipboard');
                } },
                { label: 'Send / Share', onClick: () => { setQuoteToSend(selectedQuote); setSendModalOpen(true); setSelectedQuote(null); } }
              ]} 
            />
          )
        }
      >
        {selectedQuote && (
          <div className="space-y-8">
            {/* Header: Amount Due and Status */}
            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge variant={selectedQuote.status.toLowerCase() as any}>{selectedQuote.status}</Badge>
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Quote Total</div>
              <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formatMoney(selectedQuote.total, selectedQuote.currency)}
              </div>
              
              {selectedQuote.status === 'COUNTERED' && selectedQuote.counterAmount && (
                <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl text-left">
                  <div className="text-orange-800 dark:text-orange-300 font-semibold mb-1 flex justify-between">
                    <span>Client's Counter Offer:</span>
                    <span>{formatMoney(selectedQuote.counterAmount, selectedQuote.currency)}</span>
                  </div>
                  {selectedQuote.clientMessage && (
                    <div className="text-orange-700 dark:text-orange-400 text-sm italic mb-4">
                      "{selectedQuote.clientMessage}"
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button 
                      onClick={() => { handleRespondToCounter(selectedQuote, true); setSelectedQuote(null); }}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Accept Counter
                    </button>
                    <button 
                      onClick={() => { handleRespondToCounter(selectedQuote, false); setSelectedQuote(null); }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors text-sm"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Quote To & Details */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quote For</h3>
                <p className="text-base font-medium text-slate-900 dark:text-white">
                  {clients.find(c => c.localId === selectedQuote.clientId)?.name || selectedQuote.clientId}
                </p>
                {clients.find(c => c.localId === selectedQuote.clientId)?.email && (
                  <p className="text-sm text-slate-500 mt-0.5">{clients.find(c => c.localId === selectedQuote.clientId)?.email}</p>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Quote Details</h3>
                <p className="text-sm text-slate-900 dark:text-slate-100"><span className="text-slate-500 mr-2">Issued:</span> {selectedQuote.createdAt ? new Date(selectedQuote.createdAt).toLocaleDateString() : 'N/A'}</p>
                <p className="text-sm text-slate-900 dark:text-slate-100 mt-1"><span className="text-slate-500 mr-2">Quote #:</span> {selectedQuote.quoteNumber || selectedQuote.localId.slice(0, 8)}</p>
              </div>
            </div>

            {/* Project Title / Description */}
            {selectedQuote.description && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Description</h3>
                <p className="text-base text-slate-900 dark:text-slate-100">{selectedQuote.description}</p>
              </div>
            )}

            {/* Items Table */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Line Items</h3>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Description</th>
                      <th className="px-4 py-3 font-semibold text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedQuote.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{item.description}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{item.quantity} × {formatMoney(item.unitPrice, selectedQuote.currency)}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatMoney(item.amount, selectedQuote.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {/* Summary Totals */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatMoney(selectedQuote.subtotal, selectedQuote.currency)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-3 border-t border-slate-200 dark:border-slate-700/50 mt-3">
                    <span>Total</span>
                    <span>{formatMoney(selectedQuote.total, selectedQuote.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {selectedQuote.notes && (
              <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 p-4 rounded-xl text-sm border border-amber-100 dark:border-amber-900/30">
                <span className="font-bold block mb-1">Notes / Terms:</span>
                <span className="whitespace-pre-wrap">{selectedQuote.notes}</span>
              </div>
            )}
          </div>
        )}
      </PreviewPanel>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setQuoteToDelete(null); }}
        onConfirm={() => quoteToDelete && handleDeleteQuote(quoteToDelete)}
        title="Delete Quote"
        message="Are you sure you want to delete this quote? This action cannot be undone."
      />

      <ConfirmationModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Quotes"
        message={`Are you sure you want to delete ${selectedIds.size} quotes? This action cannot be undone.`}
      />
    </div>
  );
};

export default Quotes;
