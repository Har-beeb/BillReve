import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Plus, Download, FileText, ReceiptText } from 'lucide-react';
import { Card, Badge, ProFeature, EmptyState } from '../components/ui';
import { formatMoney, formatDate } from '../utils/formatters';
import { Pagination } from '../components/Pagination';
import { PreviewPanel } from '../components/PreviewPanel';
import { db } from '../db/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import type { Invoice } from '../types';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { AiDraftModal } from '../components/AiDraftModal';
import { SendDocumentModal } from '../components/SendDocumentModal';
import { RecordPaymentModal } from '../components/RecordPaymentModal';
import { SplitButton, ActionMenu, LongPressable } from '../components/ui';
import { useAppStore } from '../store/useAppStore';
import { useSelection } from '../hooks/useSelection';
import { usePagination } from '../hooks/usePagination';
import { generateDocumentPdf } from '../utils/pdfGenerator';
import { useQuota } from '../hooks/useQuota';
import toast from 'react-hot-toast';

const Invoices: React.FC = () => {
  const navigate = useNavigate();
  const { checkQuota } = useQuota();
  
  const handleNewInvoice = () => {
    if (checkQuota('invoice')) {
      navigate('/invoices/new');
    }
  };
  const [searchParams, setSearchParams] = useSearchParams();
  const isProUser = useAppStore((state) => state.isProUser);
  const businessProfile = useAppStore((state) => state.businessProfile);
  const mobileNavStyle = useAppStore((state) => state.mobileNavStyle);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiModalDefaultTab, setAiModalDefaultTab] = useState<'text' | 'document'>('text');

  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [invoiceToSend, setInvoiceToSend] = useState<Invoice | null>(null);

  const [recordPaymentModalOpen, setRecordPaymentModalOpen] = useState(false);
  const [invoiceForPayment, setInvoiceForPayment] = useState<Invoice | null>(null);
  
  const invoices = useLiveQuery(() => db.invoices.filter(i => !i.deletedAt).toArray()) || [];
  const allClients = useLiveQuery(() => db.clients.toArray()) || [];
  const [activeCard, setActiveCard] = useState(0);
  const carouselRef = React.useRef<HTMLDivElement>(null);



  React.useEffect(() => {
    const checkOverdue = async () => {
      const now = new Date();
      now.setHours(0, 0, 0, 0); // Start of today
      
      const toUpdate = invoices.filter(i => 
        (i.status === 'SENT' || i.status === 'PARTIAL') && 
        i.dueDate && new Date(i.dueDate) < now
      );
      
      if (toUpdate.length > 0) {
        for (const inv of toUpdate) {
          const updated = { ...inv, status: 'OVERDUE' as const, updatedAt: new Date().toISOString() };
          await db.invoices.put(updated);
          await db.syncQueue.add({
            id: uuidv4(),
            action: 'UPDATE',
            entity: 'INVOICE',
            payload: updated,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
        }
      }
    };
    if (invoices.length > 0) {
      checkOverdue();
    }
  }, [invoices.length]);

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

  const filteredInvoices = invoices.filter(i => 
    (filter === 'All' || i.status === filter.toUpperCase()) &&
    (search === '' || (i.invoiceNumber && i.invoiceNumber.toLowerCase().includes(search.toLowerCase())) || i.clientId.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  
  const { currentPage, setCurrentPage, totalPages, paginatedItems: paginatedInvoices } = usePagination(filteredInvoices, 10);
  const { selectedIds, toggleSelect, toggleSelectAll, setSelectedIds } = useSelection(paginatedInvoices, (i) => i.localId);

  React.useEffect(() => {
    const previewId = searchParams.get('preview');
    if (previewId && invoices.length > 0) {
      const inv = invoices.find(i => i.localId === previewId);
      if (inv) {
        setSelectedInvoice(inv);
        setSelectedIds(new Set([inv.localId]));
        
        const index = filteredInvoices.findIndex(i => i.localId === inv.localId);
        if (index !== -1) {
          setCurrentPage(Math.ceil((index + 1) / 10));
        }

        searchParams.delete('preview');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, invoices, setSearchParams, setSelectedIds, setCurrentPage, filteredInvoices]);

  React.useEffect(() => {
    if (selectedInvoice) {
      const updated = invoices.find(i => i.localId === selectedInvoice.localId);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedInvoice)) {
        setSelectedInvoice(updated);
      }
    }
  }, [invoices, selectedInvoice]);
  const handleDownloadPdf = async (invoice: Invoice) => {
    try {
      const client = allClients.find(c => c.localId === invoice.clientId);
      await generateDocumentPdf(invoice, client, businessProfile, 'INVOICE', true);
    } catch (err) {
      console.error('Failed to generate PDF', err);
      toast.error('Failed to generate PDF');
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    await db.invoices.update(id, { deletedAt: new Date().toISOString(), syncStatus: 'pending' });
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'INVOICE',
      payload: { local_id: id, deleted_at: new Date().toISOString() },
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
    if (selectedInvoice?.localId === id) setSelectedInvoice(null);
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await db.invoices.update(id, { deletedAt: new Date().toISOString(), syncStatus: 'pending' });
      await db.syncQueue.add({
        id: uuidv4(),
        action: 'UPDATE',
        entity: 'INVOICE',
        payload: { local_id: id, deleted_at: new Date().toISOString() },
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
    setSelectedIds(new Set());
  };

  const handleBulkExportPdf = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one invoice to export.');
      return;
    }
    for (const id of selectedIds) {
      const invoice = invoices.find(i => i.localId === id);
      if (invoice) {
        await handleDownloadPdf(invoice);
      }
    }
  };

  const handleBulkExportCsv = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one invoice to export.');
      return;
    }
    const selectedInvoices = invoices.filter(i => selectedIds.has(i.localId));
    
    import('../utils/csvGenerator').then(({ exportToCsv }) => {
      const headers = ['Invoice Number', 'Client', 'Date Issued', 'Due Date', 'Status', 'Subtotal', 'Tax', 'Total', 'Amount Paid', 'Balance Due'];
      const rows = selectedInvoices.map(invoice => {
        const client = allClients.find(c => c.localId === invoice.clientId);
        const taxAmount = invoice.taxes?.reduce((sum, t) => sum + (t.isDeduction ? -t.amount : t.amount), 0) || 0;
        return [
          invoice.invoiceNumber || invoice.localId.slice(0, 8),
          client?.name || invoice.clientId,
          new Date(invoice.issuedAt || invoice.createdAt).toLocaleDateString(),
          invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'N/A',
          invoice.status,
          invoice.subtotal,
          taxAmount,
          invoice.total,
          invoice.amountPaid || 0,
          invoice.total - (invoice.amountPaid || 0)
        ];
      });
      exportToCsv(`invoices-export-${new Date().toISOString().slice(0,10)}.csv`, headers, rows);
    });
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    const updated = { ...invoice, status: 'PAID' as const, amountPaid: invoice.total, updatedAt: new Date().toISOString() };
    await db.invoices.put(updated);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'INVOICE',
      payload: updated,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  };

  const handleRecordPayment = async (amount: number) => {
    if (!invoiceForPayment) return;
    const newAmountPaid = (invoiceForPayment.amountPaid || 0) + amount;
    const newStatus = newAmountPaid >= invoiceForPayment.total ? 'PAID' : 'PARTIAL';
    const updated = { ...invoiceForPayment, status: newStatus as any, amountPaid: newAmountPaid, updatedAt: new Date().toISOString() };
    await db.invoices.put(updated);
    await db.syncQueue.add({
      id: uuidv4(),
      action: 'UPDATE',
      entity: 'INVOICE',
      payload: updated,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    setRecordPaymentModalOpen(false);
    setInvoiceForPayment(null);
  };

  const handleAiInvoiceSuccess = (generatedInvoice: any) => {
    navigate('/invoices/new', { state: { invoice: generatedInvoice } });
  };

  return (
    <div className="flex flex-col gap-6 relative animate-fade-in-up">
      <AiDraftModal 
        isOpen={isAiModalOpen} 
        onClose={() => setIsAiModalOpen(false)} 
        onSuccess={handleAiInvoiceSuccess}
        defaultTab={aiModalDefaultTab}
        documentType="INVOICE"
      />

      <SendDocumentModal
        isOpen={sendModalOpen}
        onClose={() => { setSendModalOpen(false); setInvoiceToSend(null); }}
        documentId={invoiceToSend?.localId || ''}
        clientEmail={allClients.find(c => c.localId === invoiceToSend?.clientId)?.email || ''}
        documentType="Invoice"
        amount={invoiceToSend ? formatMoney(invoiceToSend.total, invoiceToSend.currency) : ''}
      />

      <RecordPaymentModal
        isOpen={recordPaymentModalOpen}
        onClose={() => { setRecordPaymentModalOpen(false); setInvoiceForPayment(null); }}
        invoice={invoiceForPayment}
        onConfirm={handleRecordPayment}
      />

      <div className="hidden md:flex sticky top-16 z-10 bg-slate-50 dark:bg-slate-900 pt-4 pb-4 -mt-4 border-b border-slate-200 dark:border-slate-800 flex-col md:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-2 pb-2 md:pb-0">
          <SplitButton
            mainLabel={<><Plus size={18} /><span>New Invoice</span></>}
            onMainClick={handleNewInvoice}
            options={[
              { label: 'Create Manually', onClick: handleNewInvoice },
              { label: 'Draft with AI', onClick: () => { 
                  if (checkQuota('invoice')) {
                    setAiModalDefaultTab('text'); 
                    setIsAiModalOpen(true); 
                  }
              } }
            ]}
          />
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
              className={`flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedIds.size === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}`}>
              <Download size={18} />
              <span>Export CSV</span>
            </button>
          </ProFeature>
        </div>
      </div>

      <div className="md:hidden sticky top-16 z-10 bg-slate-50 dark:bg-slate-900 pt-4 pb-4 -mt-4 border-b border-slate-200 dark:border-slate-800 flex gap-2">
         <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
          />
        </div>
        
        <div className="flex-shrink-0 flex items-center">
          <SplitButton
            mainLabel={<Plus size={18} />}
            onMainClick={handleNewInvoice}
            options={[
              { label: 'Create Manually', onClick: handleNewInvoice },
              { label: 'Draft with AI', onClick: () => { 
                  if (checkQuota('invoice')) {
                    setAiModalDefaultTab('text'); 
                    setIsAiModalOpen(true); 
                  }
              } }
            ]}
          />
        </div>

        <ActionMenu 
          items={[
            { label: 'Export PDF', onClick: handleBulkExportPdf },
            ...(isProUser ? [{ label: 'Export CSV', onClick: handleBulkExportCsv }] : [])
          ]}
        />
      </div>

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
                <span className="font-semibold text-sm">Total Invoices</span>
              </div>
              <span className="text-xl font-bold">{invoices.length} invoices</span>
            </div>
          </Card>
          
          <Card className="p-4 flex-shrink-0 w-[85vw] sm:w-[300px] md:w-auto snap-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                <FileText size={16} />
                <span className="font-semibold text-sm">Paid Invoices</span>
              </div>
              <span className="text-xl font-bold">
                {invoices.filter(i => i.status === 'PAID').length} invoices ({formatMoney(invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0), 'NGN')})
              </span>
            </div>
          </Card>

          <ProFeature isProUser={isProUser} className="flex-shrink-0 w-[85vw] sm:w-[300px] md:w-auto snap-center">
            <Card className="p-4 border-red-100 dark:border-red-900/30 w-full h-full">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                  <FileText size={16} />
                  <span className="font-semibold text-sm">Overdue Invoices</span>
                </div>
                <span className="text-xl font-bold">
                  {invoices.filter(i => i.status === 'OVERDUE').length} invoices ({formatMoney(invoices.filter(i => i.status === 'OVERDUE').reduce((sum, i) => sum + (i.total - i.amountPaid), 0), 'NGN')})
                </span>
              </div>
            </Card>
          </ProFeature>
        </div>
        
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

      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="md:hidden w-full">
            <select 
              value={filter}
              onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm py-2 px-3 rounded-lg appearance-none"
            >
              {['All', 'Draft', 'Sent', 'Paid', 'Partial', 'Overdue'].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="hidden md:flex gap-1">
            {['All', 'Draft', 'Sent', 'Paid', 'Partial', 'Overdue'].map((f) => (
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

        <div className="flex items-center gap-3 px-2 border-l border-slate-200 dark:border-slate-700 ml-2 md:ml-0">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={paginatedInvoices.length > 0 && selectedIds.size === paginatedInvoices.length}
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

      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
        <div className="hidden md:grid grid-cols-12 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 uppercase tracking-wider rounded-t-xl">
          <div className="col-span-1 flex items-center">
             <input 
               type="checkbox" 
               checked={paginatedInvoices.length > 0 && selectedIds.size === paginatedInvoices.length}
               onChange={toggleSelectAll}
               className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
             />
          </div>
          <div className="col-span-4 pl-4">Client</div>
          <div className="col-span-3">Description & Dates</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right pr-8">Amount</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {paginatedInvoices.map((invoice, index) => {
            return (
              <LongPressable 
                key={invoice.localId} 
                onLongPress={() => toggleSelect(invoice.localId)}
                onClick={() => setSelectedInvoice(invoice)}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`group px-6 md:px-6 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm block cursor-pointer animate-fade-in-up ${selectedIds.has(invoice.localId) || selectedInvoice?.localId === invoice.localId ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''}`}
              >
                <div className="flex md:hidden gap-3 items-start py-4">
                  <div className="flex-shrink-0 pt-1">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(invoice.localId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(invoice.localId); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                          {invoice.invoiceNumber || invoice.localId.slice(0, 8)}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {invoice.issuedAt ? formatDate(invoice.issuedAt) : 'Not issued yet'}
                        </div>
                      </div>
                      <div className="font-bold text-base text-slate-900 dark:text-slate-100">
                         {formatMoney(invoice.total, invoice.currency)}
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <div className="flex items-center gap-3">
                        <div className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[150px] sm:max-w-[200px]">
                          {allClients.find(c => c.localId === invoice.clientId)?.name || invoice.clientId}
                        </div>
                        <Badge variant={invoice.status.toLowerCase() as any}>
                          {invoice.status === 'PARTIAL' ? 'Partial' : invoice.status}
                        </Badge>
                      </div>
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu items={[
                          { label: invoice.status === 'PAID' ? 'Download Receipt' : 'Download PDF', onClick: () => handleDownloadPdf(invoice) },
                          ...(invoice.status === 'DRAFT' ? [{ label: 'Edit', onClick: () => navigate('/invoices/new', { state: { invoice } }) }] : []),
                          ...((invoice.status === 'PARTIAL' || invoice.status === 'OVERDUE' || invoice.status === 'SENT' || invoice.status === 'DRAFT') ? [
                            { label: 'Record Payment', onClick: () => { setInvoiceForPayment(invoice); setRecordPaymentModalOpen(true); } },
                            { label: 'Mark as Paid', onClick: () => handleMarkAsPaid(invoice) }
                          ] : []),
                          { label: invoice.status === 'OVERDUE' ? 'Send Reminder' : 'Send / Share', onClick: () => { setInvoiceToSend(invoice); setSendModalOpen(true); } },
                          { label: 'Copy Payment Link', onClick: () => {
                            navigator.clipboard.writeText(`${window.location.origin}/pay/${invoice.localId}`);
                            toast.success('Payment link copied!');
                          }},
                          { label: 'Delete', onClick: () => { setInvoiceToDelete(invoice.localId); setDeleteModalOpen(true); }, variant: 'danger' }
                        ]} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden md:grid grid-cols-12 items-center w-full py-4">
                  <div className="col-span-1 flex items-center">
                    <input 
                      type="checkbox"
                      checked={selectedIds.has(invoice.localId)}
                      onChange={(e) => { e.stopPropagation(); toggleSelect(invoice.localId); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                  </div>
                  
                  <div className="col-span-4 flex flex-col justify-center">
                    <div className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors truncate pr-4">
                      {allClients.find(c => c.localId === invoice.clientId)?.name || invoice.clientId}
                    </div>
                    <div className="text-slate-500 text-xs font-medium mt-0.5">
                      {invoice.invoiceNumber || invoice.localId.slice(0, 8)}
                    </div>
                  </div>
                  
                  <div className="col-span-3 flex flex-col justify-center pr-4">
                    <div className="text-slate-600 dark:text-slate-300 text-sm truncate">
                      {invoice.description || '—'}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      {invoice.issuedAt ? `Issued ${new Date(invoice.issuedAt).toLocaleDateString()}` : 'Not issued yet'}
                    </div>
                  </div>
                  
                  <div className="col-span-2 flex items-center">
                    <Badge variant={invoice.status.toLowerCase() as any}>
                      {invoice.status === 'PARTIAL' ? 'Partial' : invoice.status}
                    </Badge>
                  </div>

                  <div className="col-span-2 flex items-center justify-end font-semibold text-slate-900 dark:text-slate-100 group-hover:text-purple-600 transition-colors">
                     {formatMoney(invoice.total, invoice.currency)}
                     <div className="ml-4 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                       <ActionMenu items={[
                         { label: invoice.status === 'PAID' ? 'Download Receipt' : 'Download PDF', onClick: () => handleDownloadPdf(invoice) },
                         ...(invoice.status === 'DRAFT' ? [{ label: 'Edit', onClick: () => navigate('/invoices/new', { state: { invoice } }) }] : []),
                         ...((invoice.status === 'PARTIAL' || invoice.status === 'OVERDUE' || invoice.status === 'SENT' || invoice.status === 'DRAFT') ? [
                           { label: 'Record Payment', onClick: () => { setInvoiceForPayment(invoice); setRecordPaymentModalOpen(true); } },
                           { label: 'Mark as Paid', onClick: () => handleMarkAsPaid(invoice) }
                         ] : []),
                         { label: invoice.status === 'OVERDUE' ? 'Send Reminder' : 'Send / Share', onClick: () => { setInvoiceToSend(invoice); setSendModalOpen(true); } },
                         { label: 'Copy Payment Link', onClick: () => {
                           navigator.clipboard.writeText(`${window.location.origin}/pay/${invoice.localId}`);
                           toast.success('Payment link copied!');
                         }},
                         { label: 'Delete', onClick: () => { setInvoiceToDelete(invoice.localId); setDeleteModalOpen(true); }, variant: 'danger' }
                       ]} />
                     </div>
                  </div>
                </div>
              </LongPressable>
          )})}
          
          {paginatedInvoices.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={ReceiptText}
                title="No invoices found"
                description={filter === 'All' ? "You haven't created any invoices yet. Create your first invoice to get paid." : `No invoices match the "${filter}" filter.`}
                actionLabel={filter === 'All' ? "Create Invoice" : undefined}
                onAction={filter === 'All' ? handleNewInvoice : undefined}
              />
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Floating Action Button */}
      {createPortal(
        <button 
          onClick={handleNewInvoice} 
          className={`md:hidden fixed ${mobileNavStyle === 'bottom' ? 'bottom-24' : 'bottom-6'} right-4 z-50 bg-purple-600 text-white p-4 rounded-full shadow-lg hover:bg-purple-700 hover:scale-110 active:scale-95 transition-all duration-300`}
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
        isOpen={selectedInvoice !== null} 
        onClose={() => setSelectedInvoice(null)}
        title="Invoice Details"
        actions={
          selectedInvoice && (
            <ActionMenu 
              items={[
                { label: selectedInvoice.status === 'PAID' ? 'Download Receipt' : 'Download PDF', onClick: () => handleDownloadPdf(selectedInvoice) },
                ...(selectedInvoice.status === 'DRAFT' ? [{ label: 'Edit Invoice', onClick: () => { navigate('/invoices/new', { state: { invoice: selectedInvoice } }); setSelectedInvoice(null); } }] : []),
                ...((selectedInvoice.status === 'PARTIAL' || selectedInvoice.status === 'OVERDUE' || selectedInvoice.status === 'SENT' || selectedInvoice.status === 'DRAFT') ? [
                  { label: 'Mark as Paid', onClick: () => handleMarkAsPaid(selectedInvoice) }
                ] : []),
                ...((selectedInvoice.status === 'PARTIAL' || selectedInvoice.status === 'OVERDUE' || selectedInvoice.status === 'SENT') ? [
                  { label: 'Copy Payment Link', onClick: () => {
                    navigator.clipboard.writeText(`${window.location.origin}/pay/${selectedInvoice.localId}`);
                    toast.success('Payment link copied to clipboard');
                  } },
                  { label: 'Send / Share', onClick: () => { setInvoiceToSend(selectedInvoice); setSendModalOpen(true); setSelectedInvoice(null); } }
                ] : [])
              ]} 
            />
          )
        }
      >
        {selectedInvoice && (
          <div className="space-y-8">
            <div className="text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Badge variant={selectedInvoice.status.toLowerCase() as any}>
                  {selectedInvoice.status === 'PARTIAL' ? 'Partial' : selectedInvoice.status}
                </Badge>
                {selectedInvoice.dueDate && new Date(selectedInvoice.dueDate) < new Date() && selectedInvoice.status !== 'PAID' && (
                  <Badge variant="overdue" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Overdue</Badge>
                )}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Amount Due</div>
              <div className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formatMoney(selectedInvoice.total - selectedInvoice.amountPaid, selectedInvoice.currency)}
              </div>
              <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-2">
                Due {selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'Upon Receipt'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Billed To</h3>
                <p className="text-base font-medium text-slate-900 dark:text-white">
                  {allClients.find(c => c.localId === selectedInvoice.clientId)?.name || selectedInvoice.clientId}
                </p>
                {allClients.find(c => c.localId === selectedInvoice.clientId)?.email && (
                  <p className="text-sm text-slate-500 mt-0.5">{allClients.find(c => c.localId === selectedInvoice.clientId)?.email}</p>
                )}
              </div>
              <div className="text-right">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Invoice Details</h3>
                <p className="text-sm text-slate-900 dark:text-slate-100"><span className="text-slate-500 mr-2">Issued:</span> {selectedInvoice.createdAt ? new Date(selectedInvoice.createdAt).toLocaleDateString() : 'N/A'}</p>
                <p className="text-sm text-slate-900 dark:text-slate-100 mt-1"><span className="text-slate-500 mr-2">Invoice #:</span> {selectedInvoice.invoiceNumber || selectedInvoice.localId.slice(0, 8)}</p>
              </div>
            </div>

            {selectedInvoice.description && (
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Project Description</h3>
                <p className="text-base text-slate-900 dark:text-slate-100">{selectedInvoice.description}</p>
              </div>
            )}

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
                    {selectedInvoice.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-slate-100">{item.description}</div>
                          <div className="text-slate-500 text-xs mt-0.5">{item.quantity} × {formatMoney(item.unitPrice, selectedInvoice.currency)}</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatMoney(item.amount, selectedInvoice.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Subtotal</span>
                    <span>{formatMoney(selectedInvoice.subtotal, selectedInvoice.currency)}</span>
                  </div>
                  {selectedInvoice.amountPaid > 0 && (
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400 font-medium">
                      <span>Amount Paid</span>
                      <span>-{formatMoney(selectedInvoice.amountPaid, selectedInvoice.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white pt-3 border-t border-slate-200 dark:border-slate-700/50 mt-3">
                    <span>Total Due</span>
                    <span>{formatMoney(selectedInvoice.total - selectedInvoice.amountPaid, selectedInvoice.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {selectedInvoice.notes && (
              <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 p-4 rounded-xl text-sm border border-amber-100 dark:border-amber-900/30">
                <span className="font-bold block mb-1">Notes / Terms:</span>
                <span className="whitespace-pre-wrap">{selectedInvoice.notes}</span>
              </div>
            )}
          </div>
        )}
      </PreviewPanel>

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setInvoiceToDelete(null); }}
        onConfirm={() => invoiceToDelete && handleDeleteInvoice(invoiceToDelete)}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This action cannot be undone."
      />

      <ConfirmationModal
        isOpen={bulkDeleteModalOpen}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Invoices"
        message={`Are you sure you want to delete ${selectedIds.size} invoices? This action cannot be undone.`}
      />
    </div>
  );
};

export default Invoices;

